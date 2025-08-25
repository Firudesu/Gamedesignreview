// Game Task Management System
class GameTaskManager {
    constructor() {
        this.games = [];
        this.tasks = [];
        this.teamMembers = [];
        this.currentGame = null;
        this.currentView = 'games';
        
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.renderGames();
    }

    // Data Management
    loadData() {
        this.games = JSON.parse(localStorage.getItem('gameTaskManager_games') || '[]');
        this.tasks = JSON.parse(localStorage.getItem('gameTaskManager_tasks') || '[]');
        this.teamMembers = JSON.parse(localStorage.getItem('gameTaskManager_members') || '[]');
    }

    saveData() {
        localStorage.setItem('gameTaskManager_games', JSON.stringify(this.games));
        localStorage.setItem('gameTaskManager_tasks', JSON.stringify(this.tasks));
        localStorage.setItem('gameTaskManager_members', JSON.stringify(this.teamMembers));
    }

    // Game Management
    addGame(gameData) {
        const game = {
            id: Date.now().toString(),
            title: gameData.title,
            description: gameData.description,
            genre: gameData.genre,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.games.push(game);
        this.saveData();
        this.renderGames();
        this.closeModal('addGameModal');
        this.showNotification('Game added successfully!', 'success');
    }

    deleteGame(gameId) {
        if (confirm('Are you sure you want to delete this game and all its tasks?')) {
            this.games = this.games.filter(g => g.id !== gameId);
            this.tasks = this.tasks.filter(t => t.gameId !== gameId);
            this.saveData();
            this.renderGames();
            this.showNotification('Game deleted successfully!', 'success');
        }
    }

    // Team Member Management
    addTeamMember(memberData) {
        const member = {
            id: Date.now().toString(),
            name: memberData.name,
            email: memberData.email,
            role: memberData.role,
            createdAt: new Date().toISOString()
        };

        this.teamMembers.push(member);
        this.saveData();
        this.updateAssigneeDropdowns();
        this.closeModal('addMemberModal');
        this.showNotification('Team member added successfully!', 'success');
    }

    // Task Management
    addTask(taskData) {
        const task = {
            id: Date.now().toString(),
            gameId: this.currentGame.id,
            title: taskData.title,
            description: taskData.description,
            category: taskData.category,
            urgency: taskData.urgency || 'medium',
            assignee: taskData.assignee,
            status: 'open',
            mediaLinks: this.parseMediaLinks(taskData.mediaLinks),
            comments: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // For review category, no urgency needed
        if (task.category === 'review') {
            task.urgency = null;
        }

        this.tasks.push(task);
        this.saveData();
        this.renderGameTasks();
        this.closeModal('newTaskModal');
        this.showNotification('Task created successfully!', 'success');
    }

    updateTask(taskId, updates) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            Object.assign(task, updates, { updatedAt: new Date().toISOString() });
            this.saveData();
            this.renderGameTasks();
        }
    }

    deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.saveData();
            this.renderGameTasks();
            this.closeModal('taskDetailModal');
            this.showNotification('Task deleted successfully!', 'success');
        }
    }

    markTaskComplete(taskId) {
        this.updateTask(taskId, { status: 'completed' });
        this.closeModal('taskDetailModal');
        this.showNotification('Task marked as complete!', 'success');
    }

    addComment(taskId, commentText) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task && commentText.trim()) {
            const comment = {
                id: Date.now().toString(),
                text: commentText.trim(),
                author: 'Current User',
                createdAt: new Date().toISOString()
            };
            task.comments.push(comment);
            this.saveData();
            this.showTaskDetail(taskId);
        }
    }

    // Media Links Parsing
    parseMediaLinks(linksText) {
        if (!linksText) return [];
        return linksText.split('\n')
            .map(link => link.trim())
            .filter(link => link.length > 0)
            .map(link => ({
                id: Date.now().toString() + Math.random(),
                url: link,
                type: this.detectLinkType(link)
            }));
    }

    detectLinkType(url) {
        if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
        if (url.includes('drive.google.com')) return 'google-drive';
        if (url.includes('dropbox.com')) return 'dropbox';
        if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'image';
        if (url.match(/\.(mp4|avi|mov|wmv)$/i)) return 'video';
        return 'link';
    }

    // UI Rendering
    renderGames() {
        const gamesList = document.getElementById('gamesList');
        
        if (this.games.length === 0) {
            gamesList.innerHTML = \`
                <div class="empty-state">
                    <i class="fas fa-gamepad"></i>
                    <h3>No games yet</h3>
                    <p>Click "Add Game" to create your first game project</p>
                </div>
            \`;
            return;
        }

        gamesList.innerHTML = this.games.map(game => \`
            <div class="game-card" onclick="gameTaskManager.showGameDetail('\${game.id}')">
                <div class="game-card-header">
                    <h3>\${this.escapeHtml(game.title)}</h3>
                    <div class="game-actions" onclick="event.stopPropagation()">
                        <button class="btn btn-danger btn-sm" onclick="gameTaskManager.deleteGame('\${game.id}')" title="Delete Game">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="game-info">
                    <p>\${this.escapeHtml(game.description || 'No description')}</p>
                    <div class="game-meta">
                        <span class="game-genre">\${game.genre ? this.escapeHtml(game.genre) : 'No genre'}</span>
                        <span class="task-count">\${this.getGameTaskCount(game.id)} tasks</span>
                    </div>
                </div>
            </div>
        \`).join('');
    }

    showGameDetail(gameId) {
        this.currentGame = this.games.find(g => g.id === gameId);
        if (!this.currentGame) return;

        document.getElementById('gamesView').style.display = 'none';
        document.getElementById('gameDetailView').style.display = 'block';
        document.getElementById('currentGameTitle').textContent = this.currentGame.title;
        
        this.currentView = 'gameDetail';
        this.renderGameTasks();
    }

    showGamesList() {
        document.getElementById('gamesView').style.display = 'block';
        document.getElementById('gameDetailView').style.display = 'none';
        this.currentView = 'games';
        this.currentGame = null;
    }

    renderGameTasks() {
        if (!this.currentGame) return;

        const gameTasks = this.tasks.filter(t => t.gameId === this.currentGame.id);
        const categories = ['bug', 'controls', 'quest', 'ui', 'performance', 'review'];

        categories.forEach(category => {
            const categoryTasks = gameTasks.filter(t => t.category === category);
            const sortedTasks = this.sortTasksByUrgency(categoryTasks);
            
            // Update count
            document.getElementById(\`\${category}Count\`).textContent = categoryTasks.length;
            
            // Render tasks
            const container = document.getElementById(\`\${category}Tasks\`);
            container.innerHTML = sortedTasks.length === 0 ? 
                '<div class="empty-category">No tasks in this category</div>' :
                sortedTasks.map(task => this.renderTaskCard(task)).join('');
        });
    }

    sortTasksByUrgency(tasks) {
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return tasks.sort((a, b) => {
            // Review tasks don't have urgency, so they go to the end
            if (a.category === 'review' && b.category !== 'review') return 1;
            if (b.category === 'review' && a.category !== 'review') return -1;
            if (a.category === 'review' && b.category === 'review') {
                return new Date(b.createdAt) - new Date(a.createdAt); // Most recent first
            }
            
            const aUrgency = urgencyOrder[a.urgency] !== undefined ? urgencyOrder[a.urgency] : 4;
            const bUrgency = urgencyOrder[b.urgency] !== undefined ? urgencyOrder[b.urgency] : 4;
            return aUrgency - bUrgency;
        });
    }

    renderTaskCard(task) {
        const statusClass = \`task-status \${task.status}\`;
        const urgencyClass = task.urgency ? \`task-urgency \${task.urgency}\` : '';
        const assignee = this.teamMembers.find(m => m.id === task.assignee);
        
        return \`
            <div class="task-card \${task.status}" onclick="gameTaskManager.showTaskDetail('\${task.id}')">
                <div class="task-card-header">
                    <h4>\${this.escapeHtml(task.title)}</h4>
                    <div class="task-meta">
                        <span class="\${statusClass}">\${task.status}</span>
                        \${task.urgency ? \`<span class="\${urgencyClass}">\${task.urgency}</span>\` : ''}
                        \${assignee ? \`<span class="task-assignee">\${this.escapeHtml(assignee.name)}</span>\` : ''}
                    </div>
                </div>
                \${task.description ? \`<p class="task-description">\${this.escapeHtml(task.description)}</p>\` : ''}
                <div class="task-card-footer">
                    <span class="task-date">\${this.formatDate(task.createdAt)}</span>
                    \${task.mediaLinks.length > 0 ? \`<span class="has-media"><i class="fas fa-link"></i> \${task.mediaLinks.length}</span>\` : ''}
                    \${task.comments.length > 0 ? \`<span class="has-comments"><i class="fas fa-comment"></i> \${task.comments.length}</span>\` : ''}
                </div>
            </div>
        \`;
    }

    showTaskDetail(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const modal = document.getElementById('taskDetailModal');
        document.getElementById('detailTaskTitle').textContent = task.title;
        document.getElementById('detailTaskStatus').textContent = task.status;
        document.getElementById('detailTaskStatus').className = \`task-status \${task.status}\`;
        document.getElementById('detailTaskCategory').textContent = task.category;
        document.getElementById('detailTaskUrgency').textContent = task.urgency || 'N/A';
        document.getElementById('detailTaskUrgency').style.display = task.urgency ? 'inline' : 'none';
        
        const assignee = this.teamMembers.find(m => m.id === task.assignee);
        document.getElementById('detailTaskAssignee').textContent = assignee ? assignee.name : 'Unassigned';
        document.getElementById('detailTaskDescription').textContent = task.description || 'No description';

        this.renderMediaLinks(task.mediaLinks);
        this.renderComments(task.comments);

        modal.dataset.taskId = taskId;
        this.showModal('taskDetailModal');
    }

    renderMediaLinks(mediaLinks) {
        const container = document.getElementById('mediaLinksContainer');
        
        if (mediaLinks.length === 0) {
            container.innerHTML = '<p class="text-muted">No media links</p>';
            return;
        }

        container.innerHTML = mediaLinks.map(link => {
            const icon = this.getMediaIcon(link.type);
            return \`
                <div class="media-link-item">
                    <i class="fas fa-\${icon}"></i>
                    <a href="\${link.url}" target="_blank" rel="noopener noreferrer">\${link.url}</a>
                </div>
            \`;
        }).join('');
    }

    getMediaIcon(type) {
        const icons = {
            youtube: 'play',
            'google-drive': 'cloud',
            dropbox: 'cloud',
            image: 'image',
            video: 'video',
            link: 'external-link-alt'
        };
        return icons[type] || 'link';
    }

    renderComments(comments) {
        const container = document.getElementById('commentsList');
        
        if (comments.length === 0) {
            container.innerHTML = '<p class="text-muted">No comments yet</p>';
            return;
        }

        container.innerHTML = comments.map(comment => \`
            <div class="comment-item">
                <div class="comment-header">
                    <strong>\${this.escapeHtml(comment.author)}</strong>
                    <span class="comment-date">\${this.formatDate(comment.createdAt)}</span>
                </div>
                <div class="comment-text">\${this.escapeHtml(comment.text)}</div>
            </div>
        \`).join('');
    }

    // Event Listeners
    setupEventListeners() {
        // Header buttons
        document.getElementById('addGameBtn').addEventListener('click', () => this.showModal('addGameModal'));
        document.getElementById('addMemberBtn').addEventListener('click', () => this.showModal('addMemberModal'));

        // Back button
        document.getElementById('backToGames').addEventListener('click', () => this.showGamesList());

        // New task button
        document.getElementById('newTaskBtn').addEventListener('click', () => {
            this.updateAssigneeDropdowns();
            this.showModal('newTaskModal');
        });

        // Form submissions
        document.getElementById('addGameForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddGame();
        });

        document.getElementById('addMemberForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddMember();
        });

        document.getElementById('newTaskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleNewTask();
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close, #cancelGame, #cancelMember, #cancelTask, #closeTaskDetail').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) this.closeModal(modal.id);
            });
        });

        // Task detail actions
        document.getElementById('deleteTask').addEventListener('click', () => {
            const taskId = document.getElementById('taskDetailModal').dataset.taskId;
            this.deleteTask(taskId);
        });

        document.getElementById('markTaskComplete').addEventListener('click', () => {
            const taskId = document.getElementById('taskDetailModal').dataset.taskId;
            this.markTaskComplete(taskId);
        });

        // Add comment
        document.getElementById('addCommentBtn').addEventListener('click', () => {
            const taskId = document.getElementById('taskDetailModal').dataset.taskId;
            const commentText = document.getElementById('newComment').value;
            this.addComment(taskId, commentText);
            document.getElementById('newComment').value = '';
        });

        // Category selection in task form
        document.getElementById('taskCategory').addEventListener('change', (e) => {
            const urgencyGroup = document.getElementById('urgencyGroup');
            urgencyGroup.style.display = e.target.value === 'review' ? 'none' : 'block';
        });

        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });
    }

    // Form Handlers
    handleAddGame() {
        this.addGame({
            title: document.getElementById('gameTitle').value,
            description: document.getElementById('gameDescription').value,
            genre: document.getElementById('gameGenre').value
        });
        
        document.getElementById('addGameForm').reset();
    }

    handleAddMember() {
        this.addTeamMember({
            name: document.getElementById('memberName').value,
            email: document.getElementById('memberEmail').value,
            role: document.getElementById('memberRole').value
        });
        
        document.getElementById('addMemberForm').reset();
    }

    handleNewTask() {
        this.addTask({
            title: document.getElementById('taskTitle').value,
            category: document.getElementById('taskCategory').value,
            urgency: document.getElementById('taskUrgency').value,
            assignee: document.getElementById('taskAssignee').value,
            description: document.getElementById('taskDescription').value,
            mediaLinks: document.getElementById('taskMediaLinks').value
        });
        
        document.getElementById('newTaskForm').reset();
    }

    // Utility Methods
    updateAssigneeDropdowns() {
        const dropdown = document.getElementById('taskAssignee');
        dropdown.innerHTML = '<option value="">Unassigned</option>' +
            this.teamMembers.map(member => 
                \`<option value="\${member.id}">\${this.escapeHtml(member.name)}</option>\`
            ).join('');
    }

    getGameTaskCount(gameId) {
        return this.tasks.filter(t => t.gameId === gameId).length;
    }

    showModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = \`notification notification-\${type}\`;
        notification.innerHTML = \`
            <i class="fas fa-\${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}"></i>
            \${message}
        \`;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application
let gameTaskManager;
document.addEventListener('DOMContentLoaded', () => {
    gameTaskManager = new GameTaskManager();
});
