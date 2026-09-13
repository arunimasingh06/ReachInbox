import { Client } from '@elastic/elasticsearch';
import { config } from '../config/env.js';
let esClient = null;
let isConnected = false;
export function getElasticClient() {
    if (!esClient) {
        esClient = new Client({
            node: config.elasticsearch.node,
            maxRetries: 3,
            requestTimeout: 5000,
        });
    }
    return esClient;
}
export async function initElasticsearch() {
    const client = getElasticClient();
    try {
        const health = await client.cluster.health({});
        isConnected = true;
        console.log(`[Elasticsearch] Connected to cluster: status=${health.status}`);
        const indexExists = await client.indices.exists({ index: config.elasticsearch.index });
        if (!indexExists) {
            console.log(`[Elasticsearch] Creating index "${config.elasticsearch.index}"...`);
            await client.indices.create({
                index: config.elasticsearch.index,
                mappings: {
                    properties: {
                        id: { type: 'keyword' },
                        userId: { type: 'keyword' },
                        senderEmail: { type: 'keyword' },
                        recipientEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                        subject: { type: 'text' },
                        body: { type: 'text' },
                        status: { type: 'keyword' },
                        scheduledTime: { type: 'date' },
                        sentAt: { type: 'date' },
                        createdAt: { type: 'date' },
                    },
                },
            });
            console.log(`[Elasticsearch] Index "${config.elasticsearch.index}" created successfully.`);
        }
    }
    catch (error) {
        console.warn('[Elasticsearch] Cluster not available or error during initialization:', error.message);
        isConnected = false;
    }
}
export async function indexEmailDocument(email) {
    if (!isConnected)
        return;
    const client = getElasticClient();
    try {
        await client.index({
            index: config.elasticsearch.index,
            id: email.id,
            document: {
                id: email.id,
                userId: email.userId,
                senderEmail: email.senderEmail,
                recipientEmail: email.recipientEmail,
                subject: email.subject,
                body: email.body,
                status: email.status,
                scheduledTime: new Date(email.scheduledTime).toISOString(),
                sentAt: email.sentAt ? new Date(email.sentAt).toISOString() : null,
                createdAt: email.createdAt ? new Date(email.createdAt).toISOString() : new Date().toISOString(),
            },
        });
    }
    catch (err) {
        console.warn(`[Elasticsearch] Failed to index document ${email.id}:`, err.message);
    }
}
export async function searchEmailDocuments(params) {
    if (!isConnected) {
        return { items: [], total: 0 };
    }
    const client = getElasticClient();
    const from = ((params.page || 1) - 1) * (params.limit || 20);
    const size = params.limit || 20;
    const mustClauses = [{ term: { userId: params.userId } }];
    if (params.status) {
        mustClauses.push({ term: { status: params.status } });
    }
    if (params.query && params.query.trim()) {
        mustClauses.push({
            multi_match: {
                query: params.query,
                fields: ['subject^3', 'body^2', 'recipientEmail', 'senderEmail'],
                fuzziness: 'AUTO',
            },
        });
    }
    try {
        const result = await client.search({
            index: config.elasticsearch.index,
            from,
            size,
            query: {
                bool: {
                    must: mustClauses,
                },
            },
            sort: [{ scheduledTime: { order: 'desc' } }],
        });
        const hits = result.hits.hits || [];
        const total = typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value || 0;
        const items = hits.map((h) => h._source);
        return { items, total };
    }
    catch (err) {
        console.warn('[Elasticsearch] Search query failed:', err.message);
        return { items: [], total: 0 };
    }
}
