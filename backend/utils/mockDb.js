import mongoose from 'mongoose';

const mockDbStore = {};

class MockDocument {
  constructor(modelName, data) {
    this._modelName = modelName;
    Object.assign(this, JSON.parse(JSON.stringify(data || {})));
    if (!this._id && !this.id) {
      this._id = Math.random().toString(36).substring(2, 9);
    }
  }

  async save() {
    const modelStore = mockDbStore[this._modelName];
    const index = modelStore.findIndex(d => d._id === this._id || (this.id && d.id === this.id));
    if (index !== -1) {
      modelStore[index] = this;
    } else {
      modelStore.push(this);
    }
    return this;
  }
}

class MockQuery {
  constructor(execPromise) {
    this._execPromise = execPromise;
  }

  then(onfulfilled, onrejected) {
    return this._execPromise.then(onfulfilled, onrejected);
  }

  sort(sortObj) {
    const nextPromise = this._execPromise.then(result => {
      if (!result) return result;

      const sortFn = (a, b) => {
        for (const key of Object.keys(sortObj)) {
          const dir = sortObj[key];
          const valA = a[key];
          const valB = b[key];
          if (valA < valB) return dir === -1 ? 1 : -1;
          if (valA > valB) return dir === -1 ? -1 : 1;
        }
        return 0;
      };

      if (Array.isArray(result)) {
        return [...result].sort(sortFn);
      }
      return result;
    });
    return new MockQuery(nextPromise);
  }

  limit(limitVal) {
    const nextPromise = this._execPromise.then(result => {
      if (Array.isArray(result)) {
        return result.slice(0, limitVal);
      }
      return result;
    });
    return new MockQuery(nextPromise);
  }

  exec() {
    return this._execPromise;
  }
}

export function getMockModel(modelName, schema) {
  if (!mockDbStore[modelName]) {
    mockDbStore[modelName] = [];
  }

  const decorateData = (data) => {
    if (!data || typeof data !== 'object') return data;

    if (Array.isArray(data)) {
      if (!data.id) {
        data.id = function(idVal) {
          return this.find(item => item._id === idVal || item.id === idVal);
        };
      }
      for (const item of data) {
        decorateData(item);
      }
      return data;
    }

    if (!data.toObject) {
      data.toObject = function() {
        const obj = {};
        for (const key of Object.keys(this)) {
          if (key !== 'toObject' && key !== 'id' && !key.startsWith('_')) {
            obj[key] = JSON.parse(JSON.stringify(this[key]));
          }
        }
        if (this._id) obj._id = this._id;
        if (this.id) obj.id = this.id;
        return obj;
      };
    }

    for (const key of Object.keys(data)) {
      if (key !== 'toObject' && key !== 'id' && data[key] && typeof data[key] === 'object') {
        decorateData(data[key]);
      }
    }
    return data;
  };

  const matchesQuery = (doc, query) => {
    if (!query) return true;
    for (const key of Object.keys(query)) {
      if (doc[key] !== query[key]) {
        return false;
      }
    }
    return true;
  };

  const MockModelClass = class {
    constructor(data) {
      const doc = new MockDocument(modelName, data);
      decorateData(doc);
      return doc;
    }

    static findOne(query) {
      const promise = Promise.resolve().then(() => {
        const doc = mockDbStore[modelName].find(d => matchesQuery(d, query));
        if (!doc) return null;
        decorateData(doc);
        return doc;
      });
      return new MockQuery(promise);
    }

    static find(query) {
      const promise = Promise.resolve().then(() => {
        const list = mockDbStore[modelName].filter(d => matchesQuery(d, query));
        list.forEach(decorateData);
        return list;
      });
      return new MockQuery(promise);
    }

    static findOneAndUpdate(query, update, options = {}) {
      const promise = Promise.resolve().then(() => {
        let doc = mockDbStore[modelName].find(d => matchesQuery(d, query));
        if (!doc) {
          if (options.upsert) {
            const newData = { ...query, ...(update.$set || update) };
            doc = new MockDocument(modelName, newData);
            mockDbStore[modelName].push(doc);
          } else {
            return null;
          }
        } else {
          const updateData = update.$set || update;
          Object.assign(doc, JSON.parse(JSON.stringify(updateData)));
        }
        decorateData(doc);
        return doc;
      });
      return new MockQuery(promise);
    }

    static deleteOne(query) {
      const promise = Promise.resolve().then(() => {
        const index = mockDbStore[modelName].findIndex(d => matchesQuery(d, query));
        if (index !== -1) {
          mockDbStore[modelName].splice(index, 1);
          return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
      });
      return new MockQuery(promise);
    }

    static deleteMany(query) {
      const promise = Promise.resolve().then(() => {
        const initialCount = mockDbStore[modelName].length;
        mockDbStore[modelName] = mockDbStore[modelName].filter(d => !matchesQuery(d, query));
        const deletedCount = initialCount - mockDbStore[modelName].length;
        return { deletedCount };
      });
      return new MockQuery(promise);
    }

    static findByIdAndDelete(id) {
      const promise = Promise.resolve().then(() => {
        const index = mockDbStore[modelName].findIndex(d => d._id === id || d.id === id);
        if (index !== -1) {
          mockDbStore[modelName].splice(index, 1);
          return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
      });
      return new MockQuery(promise);
    }
  };

  return MockModelClass;
}

export function createModelWrapper(modelName, schema, realModel) {
  const MockModel = getMockModel(modelName, schema);

  return new Proxy(realModel, {
    construct(target, args) {
      if (mongoose.connection.readyState === 1) {
        return Reflect.construct(target, args);
      } else {
        return Reflect.construct(MockModel, args);
      }
    },
    get(target, prop, receiver) {
      if (mongoose.connection.readyState === 1) {
        return Reflect.get(target, prop, receiver);
      } else {
        if (prop in MockModel) {
          return Reflect.get(MockModel, prop);
        }
        return Reflect.get(target, prop, receiver);
      }
    }
  });
}
