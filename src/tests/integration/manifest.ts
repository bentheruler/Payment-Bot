import fs from 'fs/promises';
import path from 'path';

export interface Phase9Manifest {
  testRunId: string;
  startedAt: string;
  environment: string;
  createdIds: {
    userId: string | null;
    authSessionId: string | null;
    paymentId: string | null;
    subscriptionId: string | null;
    telegramAccessId: string | null;
    webhookEventIds: string[];
  };
}

const MANIFEST_PATH = path.resolve(process.cwd(), 'phase9-test-manifest.json');

export async function createTestManifest(): Promise<Phase9Manifest> {
  const manifest: Phase9Manifest = {
    testRunId: `run_${Date.now()}`,
    startedAt: new Date().toISOString(),
    environment: "phase9-integration",
    createdIds: {
      userId: null,
      authSessionId: null,
      paymentId: null,
      subscriptionId: null,
      telegramAccessId: null,
      webhookEventIds: []
    }
  };
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
  return manifest;
}

export async function readManifest(): Promise<Phase9Manifest> {
  try {
    const data = await fs.readFile(MANIFEST_PATH, 'utf-8');
    return JSON.parse(data) as Phase9Manifest;
  } catch (error) {
    throw new Error('Failed to read test manifest: ' + String(error));
  }
}

export async function updateManifest(
  updates: Partial<Phase9Manifest['createdIds']>
): Promise<void> {
  const manifest = await readManifest();
  manifest.createdIds = {
    ...manifest.createdIds,
    ...updates,
    webhookEventIds: [
      ...manifest.createdIds.webhookEventIds,
      ...(updates.webhookEventIds || [])
    ]
  };
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
}
