import { MongoClient, ObjectId } from 'mongodb';

/**
 * Tiny in-memory stand-in for the MongoDB driver, covering only the
 * operations grading-service uses (find/findOne with equality, $in, $ne and
 * dotted array paths; sort/limit; insertOne; updateOne with $set incl. the
 * positional `$`, and $unset). Installed by patching MongoClient so the real
 * connection/collections modules run unchanged.
 */

type Doc = Record<string, any>;

const clone = (v: any): any => {
  if (v instanceof ObjectId || v instanceof Date) return v;
  if (Array.isArray(v)) return v.map(clone);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]));
  return v;
};

const same = (a: any, b: any): boolean => {
  if (a instanceof ObjectId || b instanceof ObjectId) return String(a) === String(b);
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
};

/** Every value reachable at a dotted path, fanning out over arrays. */
function valuesAt(doc: any, path: string[]): any[] {
  if (!path.length) return [doc];
  if (doc == null) return [undefined];
  if (Array.isArray(doc)) return doc.flatMap((d) => valuesAt(d, path));
  return valuesAt(doc[path[0]!], path.slice(1));
}

function matchValue(values: any[], cond: any): boolean {
  if (cond && typeof cond === 'object' && !(cond instanceof ObjectId) && !(cond instanceof Date) && !Array.isArray(cond)) {
    return Object.entries(cond).every(([op, arg]) => {
      if (op === '$in') return values.some((v) => (arg as any[]).some((a) => same(v, a)));
      if (op === '$ne') return !values.some((v) => same(v, arg));
      if (op === '$exists') return values.some((v) => v !== undefined) === arg;
      throw new Error(`fake-mongo: unsupported operator ${op}`);
    });
  }
  return values.some((v) => same(v, cond));
}

const matches = (doc: Doc, filter: Doc = {}) =>
  Object.entries(filter).every(([k, cond]) => matchValue(valuesAt(doc, k.split('.')), cond));

function setPath(doc: any, path: string[], value: any) {
  let cur = doc;
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]!] ??= {};
  if (value === undefined) delete cur[path[path.length - 1]!];
  else cur[path[path.length - 1]!] = clone(value);
}

class Cursor {
  constructor(private docs: Doc[]) {}
  sort(spec: Record<string, 1 | -1>) {
    const [[key, dir]] = Object.entries(spec) as [[string, 1 | -1]];
    this.docs.sort((a, b) => (a[key] > b[key] ? dir : a[key] < b[key] ? -dir : 0));
    return this;
  }
  limit(n: number) {
    this.docs = this.docs.slice(0, n);
    return this;
  }
  async toArray() {
    return this.docs.map(clone);
  }
}

export class FakeCollection {
  docs: Doc[] = [];
  find(filter?: Doc) {
    return new Cursor(this.docs.filter((d) => matches(d, filter)));
  }
  async findOne(filter?: Doc) {
    const d = this.docs.find((x) => matches(x, filter));
    return d ? clone(d) : null;
  }
  async insertOne(doc: Doc) {
    const stored = clone({ _id: new ObjectId(), ...doc });
    this.docs.push(stored);
    return { insertedId: stored._id };
  }
  async updateOne(filter: Doc, update: Doc) {
    const doc = this.docs.find((x) => matches(x, filter));
    if (!doc) return { matchedCount: 0, modifiedCount: 0 };
    for (const [key, value] of Object.entries(update.$set ?? {})) {
      const parts = key.split('.');
      const pos = parts.indexOf('$');
      if (pos === -1) {
        setPath(doc, parts, value);
        continue;
      }
      // Positional: index of the array element the filter matched on.
      const arrayPath = parts.slice(0, pos);
      const arr = valuesAt(doc, arrayPath)[0] as any[];
      const cond = Object.entries(filter).find(([k]) => k.startsWith(arrayPath.join('.') + '.'));
      const idx = arr.findIndex((el) => !cond || matchValue(valuesAt(el, cond[0].split('.').slice(pos)), cond[1]));
      setPath(arr[idx], parts.slice(pos + 1), value);
    }
    for (const key of Object.keys(update.$unset ?? {})) setPath(doc, key.split('.'), undefined);
    return { matchedCount: 1, modifiedCount: 1 };
  }
  async createIndex() {
    return 'ok';
  }
}

const databases = new Map<string, Map<string, FakeCollection>>();

export function fakeCollection(db: string, name: string): FakeCollection {
  if (!databases.has(db)) databases.set(db, new Map());
  const cols = databases.get(db)!;
  if (!cols.has(name)) cols.set(name, new FakeCollection());
  return cols.get(name)!;
}

export function installFakeMongo() {
  MongoClient.prototype.connect = async function () {
    return this;
  } as any;
  MongoClient.prototype.db = function (name?: string) {
    const dbName = name ?? 'default';
    return { collection: (c: string) => fakeCollection(dbName, c) } as any;
  } as any;
  MongoClient.prototype.close = async function () {} as any;
}
