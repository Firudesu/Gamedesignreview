// Database management using IndexedDB
class GameTrackerDB {
    constructor() {
        this.dbName = 'GameTrackerDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create Games store
                if (!db.objectStoreNames.contains('games')) {
                    const gamesStore = db.createObjectStore('games', { keyPath: 'id', autoIncrement: true });
                    gamesStore.createIndex('name', 'name', { unique: false });
                    gamesStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Create Issues store
                if (!db.objectStoreNames.contains('issues')) {
                    const issuesStore = db.createObjectStore('issues', { keyPath: 'id', autoIncrement: true });
                    issuesStore.createIndex('gameId', 'gameId', { unique: false });
                    issuesStore.createIndex('category', 'category', { unique: false });
                    issuesStore.createIndex('urgency', 'urgency', { unique: false });
                    issuesStore.createIndex('status', 'status', { unique: false });
                    issuesStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Create Members store
                if (!db.objectStoreNames.contains('members')) {
                    const membersStore = db.createObjectStore('members', { keyPath: 'id', autoIncrement: true });
                    membersStore.createIndex('name', 'name', { unique: false });
                    membersStore.createIndex('email', 'email', { unique: true });
                }
            };
        });
    }

    // Generic CRUD operations
    async add(storeName, data) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add({
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, id) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName, indexName = null, value = null) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        let request;
        if (indexName && value !== null) {
            const index = store.index(indexName);
            request = index.getAll(value);
        } else {
            request = store.getAll();
        }

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async update(storeName, id, data) {
        const existing = await this.get(storeName, id);
        const updated = {
            ...existing,
            ...data,
            id: id,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString()
        };

        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(updated);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(updated);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Game-specific methods
    async addGame(gameData) {
        return await this.add('games', gameData);
    }

    async getGames() {
        return await this.getAll('games');
    }

    async getGame(id) {
        return await this.get('games', id);
    }

    async updateGame(id, gameData) {
        return await this.update('games', id, gameData);
    }

    async deleteGame(id) {
        // Delete all issues associated with this game first
        const issues = await this.getIssuesByGame(id);
        for (const issue of issues) {
            await this.delete('issues', issue.id);
        }
        // Then delete the game
        return await this.delete('games', id);
    }

    // Issue-specific methods
    async addIssue(issueData) {
        return await this.add('issues', issueData);
    }

    async getIssue(id) {
        return await this.get('issues', id);
    }

    async getIssuesByGame(gameId) {
        return await this.getAll('issues', 'gameId', gameId);
    }

    async updateIssue(id, issueData) {
        return await this.update('issues', id, issueData);
    }

    async deleteIssue(id) {
        return await this.delete('issues', id);
    }

    // Member-specific methods
    async addMember(memberData) {
        return await this.add('members', memberData);
    }

    async getMembers() {
        return await this.getAll('members');
    }

    async getMember(id) {
        return await this.get('members', id);
    }

    async updateMember(id, memberData) {
        return await this.update('members', id, memberData);
    }

    async deleteMember(id) {
        return await this.delete('members', id);
    }
}

// Create a global database instance
const db = new GameTrackerDB();