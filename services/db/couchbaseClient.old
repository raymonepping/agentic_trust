import couchbase from "couchbase";

let cluster;
let bucket;
let cachedScope;
let cachedCollection;

async function initCluster() {
  if (cluster) {
    return cluster;
  }

  const connStr = process.env.CB_CONN_STR;
  const username = process.env.CB_USERNAME;
  const password = process.env.CB_PASSWORD;
  const bucketName = process.env.CB_BUCKET;

  if (!connStr || !username || !password || !bucketName) {
    throw new Error("Couchbase env vars are missing");
  }

  cluster = await couchbase.connect(connStr, {
    username,
    password,
  });

  bucket = cluster.bucket(bucketName);
  return cluster;
}

export async function getCluster() {
  if (!cluster) {
    await initCluster();
  }
  return cluster;
}

export async function getBucket() {
  if (!bucket) {
    await initCluster();
  }
  return bucket;
}

export async function getScope() {
  if (cachedScope) {
    return cachedScope;
  }

  const bucketName = process.env.CB_BUCKET;
  const scopeName = process.env.CB_SCOPE || "_default";

  const b = await getBucket();
  cachedScope = b.scope(scopeName);
  return cachedScope;
}

export async function getCollection() {
  if (cachedCollection) {
    return cachedCollection;
  }

  const collectionName = process.env.CB_COLLECTION || "missions";
  const scope = await getScope();

  cachedCollection = scope.collection(collectionName);
  return cachedCollection;
}

// Note: the query API in newer Couchbase SDKs can use either cluster.query or scope.query.
// This file is written to be compatible with scope.query. When wiring it to a real cluster,
// verify syntax with current Couchbase Node SDK docs.
