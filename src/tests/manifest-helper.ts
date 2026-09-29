import fs from 'fs';
import path from 'path';

const MANIFEST_PATH = path.join(process.cwd(), 'phase9-test-manifest.json');

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

export function loadManifest(): Phase9Manifest | null {
  try {
    if (!fs.existsSync(MANIFEST_PATH)) {
      return null;
    }
    const data = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load phase9 test manifest:', err);
    return null;
  }
}

export function saveManifest(manifest: Phase9Manifest): void {
  try {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save phase9 test manifest:', err);
  }
}

export function initializeManifest(): Phase9Manifest {
  const existing = loadManifest();
  if (existing) {
    return existing;
  }
  
  const manifest: Phase9Manifest = {
    testRunId: `run_${Date.now()}`,
    startedAt: new Date().toISOString(),
    environment: 'phase9-integration',
    createdIds: {
      userId: null,
      authSessionId: null,
      paymentId: null,
      subscriptionId: null,
      telegramAccessId: null,
      webhookEventIds: [],
    }
  };
  
  saveManifest(manifest);
  return manifest;
}

export function recordId(type: keyof Phase9Manifest['createdIds'], id: string): void {
  const manifest = loadManifest() || initializeManifest();
  
  if (type === 'webhookEventIds') {
    if (!manifest.createdIds.webhookEventIds.includes(id)) {
      manifest.createdIds.webhookEventIds.push(id);
    }
  } else {
    const key = type as Exclude<keyof Phase9Manifest['createdIds'], 'webhookEventIds'>;
    manifest.createdIds[key] = id;
  }
  
  saveManifest(manifest);
}
