class IDBDriver {
    private _db: IDBDatabase = null!;

    static async create(name: string, version: number, stores?: string[]) {
        return new Promise<IDBDriver>((resolve, reject) => {
            const request = indexedDB.open(name, version);

            request.onerror = (event) => {
                reject(new Error(`IndexedDB error: ${request.error}`));
            };

            request.onsuccess = (event) => {
                const driver = new IDBDriver();
                driver._db = request.result;

                resolve(driver);
            };

            request.onupgradeneeded = (event) => {
                const db = request.result;

                for(const storeName of stores ?? []) {
                    if(db.objectStoreNames.contains(storeName)) {
                        db.deleteObjectStore(storeName);
                    }


                    db.createObjectStore(storeName);
                }
            };
        });
    }

    static async delete(name: string) {
        return new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name);

            request.onerror = (event) => {
                reject(new Error(`IndexedDB error: ${request.error}`));
            };

            request.onsuccess = (event) => {
                resolve();
            };
        });
    }

    async read(store: string, key: IDBValidKey) {
        return new Promise<any>((resolve, reject) => {
            const transaction = this._db.transaction([store], "readonly");
            const objectStore = transaction.objectStore(store);
            const request = objectStore.get(key);

            request.onerror = (event) => {
                reject(new Error(`IndexedDB error: ${request.error}`));
            };

            request.onsuccess = (event) => {
                resolve(request.result);
            };
        });
    }

    async write(store: string, key: IDBValidKey, value: any) {
        return new Promise<void>((resolve, reject) => {
            const transaction = this._db.transaction([store], "readwrite");
            const objectStore = transaction.objectStore(store);
            const request = objectStore.put(value, key);

            request.onerror = (event) => {
                reject(new Error(`IndexedDB error: ${request.error}`));
            };

            request.onsuccess = (event) => {
                resolve();
            };
        });
    }

    async delete(store: string, key: IDBValidKey) {
        return new Promise<void>((resolve, reject) => {
            const transaction = this._db.transaction([store], "readwrite");
            const objectStore = transaction.objectStore(store);
            const request = objectStore.delete(key);

            request.onerror = (event) => {
                reject(new Error(`IndexedDB error: ${request.error}`));
            };

            request.onsuccess = (event) => {
                resolve();
            };
        });
    }

    async *iterate(store: string) {
        const transaction = this._db.transaction([store], "readonly");
        const objectStore = transaction.objectStore(store);
        const request = objectStore.openCursor();

        while(true) {
            const cursor = await new Promise<IDBCursorWithValue | null>((resolve, reject) => {
                request.onerror = (event) => reject(new Error(`IndexedDB error: ${request.error}`));
                request.onsuccess = (event) => resolve(request.result);
            });

            if(!cursor) {
                break;
            }

            yield { key: cursor.key, value: cursor.value };
            cursor.continue();
        }
    }
}

export { IDBDriver };