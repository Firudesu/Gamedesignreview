// Main application logic
class GameTracker {
    constructor() {
        this.currentGame = null;
        this.members = [];
        this.init();
    }

    async init() {
        // Initialize database
        await db.init();
        
        // Load initial data
        await this.loadGames();
        await this.loadMembers();
        
        // Set up event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add Game button
        document.getElementById('addGameBtn').addEventListener('click', () => {
            this.showModal('addGameModal');
        });

        // Add Member button
        document.getElementById('addMemberBtn').addEventListener('click', () => {
            this.showModal('addMemberModal');
        });

        // Add Game form submission
        document.getElementById('addGameForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.addGame();
        });

        // Add Member form submission
        document.getElementById('addMemberForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.addMember();
        });

        // Modal close buttons
        document.querySelectorAll('.close-btn, .cancel-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.hideModal(modal.id);
                }
            });
        });

        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });
    }

    async loadGames() {
        const games = await db.getGames();
        this.renderGames(games);
    }

    async loadMembers() {
        this.members = await db.getMembers();
    }

    renderGames(games) {
        const gamesList = document.getElementById('gamesList');
        
        if (games.length === 0) {
            gamesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-gamepad"></i>
                    <p>No games added yet</p>
                    <p class="text-muted">Click "Add Game" to get started</p>
                </div>
            `;
            return;
        }

        gamesList.innerHTML = games.map(game => `
            <div class="game-card" data-game-id="${game.id}">
                <div class="game-card-header">
                    <h3>${this.escapeHtml(game.name)}</h3>
                    <div class="game-actions">
                        <button class="btn-icon edit-game" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-game" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="game-card-body">
                    <p class="game-platform"><i class="fas fa-desktop"></i> ${game.platform}</p>
                    ${game.description ? `<p class="game-description">${this.escapeHtml(game.description)}</p>` : ''}
                    <div class="game-stats">
                        <span class="stat" id="issues-${game.id}">
                            <i class="fas fa-exclamation-circle"></i> Loading...
                        </span>
                    </div>
                </div>
                <button class="btn btn-primary btn-full view-game">
                    View Issues <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        `).join('');

        // Add click handlers
        gamesList.querySelectorAll('.view-game').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const gameId = e.target.closest('.game-card').dataset.gameId;
                this.viewGame(parseInt(gameId));
            });
        });

        gamesList.querySelectorAll('.edit-game').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const gameId = e.target.closest('.game-card').dataset.gameId;
                this.editGame(parseInt(gameId));
            });
        });

        gamesList.querySelectorAll('.delete-game').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const gameId = e.target.closest('.game-card').dataset.gameId;
                this.deleteGame(parseInt(gameId));
            });
        });

        // Load issue counts for each game
        games.forEach(async (game) => {
            const issues = await db.getIssuesByGame(game.id);
            const statElement = document.getElementById(`issues-${game.id}`);
            if (statElement) {
                statElement.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${issues.length} issues`;
            }
        });
    }

    async addGame() {
        const form = document.getElementById('addGameForm');
        const gameData = {
            name: form.gameName.value.trim(),
            description: form.gameDescription.value.trim(),
            platform: form.gamePlatform.value
        };

        if (!gameData.name) {
            alert('Please enter a game name');
            return;
        }

        try {
            await db.addGame(gameData);
            this.hideModal('addGameModal');
            form.reset();
            await this.loadGames();
            this.showNotification('Game added successfully!', 'success');
        } catch (error) {
            console.error('Error adding game:', error);
            this.showNotification('Error adding game', 'error');
        }
    }

    async editGame(gameId) {
        // For now, we'll use a simple prompt. In a real app, you'd use a modal
        const game = await db.getGame(gameId);
        const newName = prompt('Edit game name:', game.name);
        
        if (newName && newName.trim() !== game.name) {
            try {
                await db.updateGame(gameId, { name: newName.trim() });
                await this.loadGames();
                this.showNotification('Game updated successfully!', 'success');
            } catch (error) {
                console.error('Error updating game:', error);
                this.showNotification('Error updating game', 'error');
            }
        }
    }

    async deleteGame(gameId) {
        const game = await db.getGame(gameId);
        if (confirm(`Are you sure you want to delete "${game.name}"? This will also delete all associated issues.`)) {
            try {
                await db.deleteGame(gameId);
                await this.loadGames();
                this.showNotification('Game deleted successfully!', 'success');
            } catch (error) {
                console.error('Error deleting game:', error);
                this.showNotification('Error deleting game', 'error');
            }
        }
    }

    viewGame(gameId) {
        // Navigate to game detail page
        window.location.href = `game-detail.html?id=${gameId}`;
    }

    async addMember() {
        const form = document.getElementById('addMemberForm');
        const memberData = {
            name: form.memberName.value.trim(),
            role: form.memberRole.value,
            email: form.memberEmail.value.trim()
        };

        if (!memberData.name) {
            alert('Please enter a member name');
            return;
        }

        try {
            await db.addMember(memberData);
            this.hideModal('addMemberModal');
            form.reset();
            await this.loadMembers();
            this.showNotification('Member added successfully!', 'success');
        } catch (error) {
            console.error('Error adding member:', error);
            if (error.name === 'ConstraintError') {
                this.showNotification('A member with this email already exists', 'error');
            } else {
                this.showNotification('Error adding member', 'error');
            }
        }
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        // Add to document
        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => notification.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GameTracker();
});