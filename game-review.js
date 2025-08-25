// Game Design Review System - Game-based Task Management
class GameDesignReview {
    constructor() {
        this.currentGame = null;
        this.currentCategory = 'all';
        this.games = [];
        this.members = [];
        this.filters = {
            status: 'all',
            priority: 'all',
            assignee: 'all'
        };
        
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.loadCurrentGame();
        this.renderIssues();
        this.updateStatistics();
        this.populateFilters();
    }

    // Data Management
    loadData() {
        this.games = this.loadFromStorage('gameReviewGames') || [];
        this.members = this.loadFromStorage('gameReviewMembers') || [];
    }

    saveData() {
        this.saveToStorage('gameReviewGames', this.games);
        this.saveToStorage('gameReviewMembers', this.members);
    }

    loadFromStorage(key) {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : null;
    }

    saveToStorage(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    loadCurrentGame() {
        const gameId = localStorage.getItem('currentGameId');
        if (gameId) {
            this.currentGame = this.games.find(g => g.id === gameId);
            if (this.currentGame) {
                document.getElementById('gameTitle').textContent = this.currentGame.name;
            } else {
                // Game not found, redirect back to main page
                window.location.href = 'Index.html';
            }
        } else {
            // No game selected, redirect back to main page
            window.location.href = 'Index.html';
        }
    }

    // Task Management
    addTask(taskData) {
        if (!this.currentGame) return;

        const task = {
            id: Date.now().toString(),
            title: taskData.title,
            description: taskData.description,
            category: taskData.category,
            priority: taskData.priority || 'medium',
            urgency: taskData.urgency || 'medium',
            assignee: taskData.assignee || '',
            status: 'open',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            mediaLinks: taskData.mediaLinks ? taskData.mediaLinks.split('\n').filter(link => link.trim()) : []
        };

        // Add to the appropriate category
        if (!this.currentGame.issues[taskData.category]) {
            this.currentGame.issues[taskData.category] = [];
        }
        this.currentGame.issues[taskData.category].push(task);

        this.saveData();
        this.renderIssues();
        this.updateStatistics();
    }

    updateTask(taskId, updates) {
        if (!this.currentGame) return;

        // Find the task in any category
        for (const category in this.currentGame.issues) {
            const taskIndex = this.currentGame.issues[category].findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                Object.assign(this.currentGame.issues[category][taskIndex], updates, { 
                    updatedAt: new Date().toISOString() 
                });
                break;
            }
        }

        this.saveData();
        this.renderIssues();
        this.updateStatistics();
    }

    deleteTask(taskId) {
        if (!this.currentGame) return;

        // Remove from the appropriate category
        for (const category in this.currentGame.issues) {
            this.currentGame.issues[category] = this.currentGame.issues[category].filter(t => t.id !== taskId);
        }

        this.saveData();
        this.renderIssues();
        this.updateStatistics();
    }

    // Issue Rendering
    renderIssues() {
        const issuesList = document.getElementById('issuesList');
        const tasks = this.getFilteredTasks();

        if (tasks.length === 0) {
            issuesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h3>No tasks found</h3>
                    <p>${this.currentCategory === 'all' ? 'Create your first task to get started' : `No ${this.currentCategory} tasks found`}</p>
                </div>
            `;
            return;
        }

        // Sort tasks by urgency and priority
        const sortedTasks = this.sortTasksByUrgency(tasks);

        issuesList.innerHTML = sortedTasks.map(task => this.renderTaskCard(task)).join('');
    }

    getFilteredTasks() {
        if (!this.currentGame) return [];

        let tasks = [];
        
        if (this.currentCategory === 'all') {
            // Get all tasks from all categories
            for (const category in this.currentGame.issues) {
                tasks = tasks.concat(this.currentGame.issues[category]);
            }
        } else {
            // Get tasks from specific category
            tasks = this.currentGame.issues[this.currentCategory] || [];
        }

        // Apply filters
        return tasks.filter(task => {
            if (this.filters.status !== 'all' && task.status !== this.filters.status) return false;
            if (this.filters.priority !== 'all' && task.priority !== this.filters.priority) return false;
            if (this.filters.assignee !== 'all' && task.assignee !== this.filters.assignee) return false;
            return true;
        });
    }

    sortTasksByUrgency(tasks) {
        const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

        return tasks.sort((a, b) => {
            // First sort by urgency
            const urgencyDiff = urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
            if (urgencyDiff !== 0) return urgencyDiff;

            // Then by priority
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            if (priorityDiff !== 0) return priorityDiff;

            // Finally by creation date (newest first)
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    }

    renderTaskCard(task) {
        const assignee = this.members.find(m => m.id === task.assignee);
        const assigneeName = assignee ? assignee.name : 'Unassigned';
        const assigneeInitials = assignee ? assignee.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';

        return `
            <div class="issue-card" onclick="gameReview.openTaskDetail('${task.id}')">
                <div class="issue-header">
                    <div>
                        <div class="issue-title">${task.title}</div>
                        <div class="issue-meta">
                            <span class="issue-category ${task.category}">${task.category}</span>
                            ${task.category !== 'review' ? `
                                <span class="issue-priority ${task.priority}">${task.priority}</span>
                                <span class="issue-priority ${task.urgency}">${task.urgency} urgency</span>
                            ` : ''}
                            <span class="issue-status ${task.status}">${task.status}</span>
                        </div>
                    </div>
                </div>
                <div class="issue-description">${task.description}</div>
                <div class="issue-footer">
                    <div class="issue-assignee">
                        <div class="assignee-avatar">${assigneeInitials}</div>
                        <span>${assigneeName}</span>
                    </div>
                    <span>${this.formatDate(task.createdAt)}</span>
                </div>
            </div>
        `;
    }

    // Task Detail Modal
    openTaskDetail(taskId) {
        const task = this.findTask(taskId);
        if (!task) return;

        const assignee = this.members.find(m => m.id === task.assignee);
        const assigneeName = assignee ? assignee.name : 'Unassigned';

        document.getElementById('taskDetailTitle').textContent = task.title;
        
        const content = `
            <div class="task-detail-content">
                <div class="task-info">
                    <div class="task-info-item">
                        <span class="task-info-label">Category</span>
                        <span class="task-info-value">${task.category}</span>
                    </div>
                    ${task.category !== 'review' ? `
                        <div class="task-info-item">
                            <span class="task-info-label">Priority</span>
                            <span class="task-info-value">${task.priority}</span>
                        </div>
                        <div class="task-info-item">
                            <span class="task-info-label">Urgency</span>
                            <span class="task-info-value">${task.urgency}</span>
                        </div>
                    ` : ''}
                    <div class="task-info-item">
                        <span class="task-info-label">Status</span>
                        <span class="task-info-value">${task.status}</span>
                    </div>
                    <div class="task-info-item">
                        <span class="task-info-label">Assignee</span>
                        <span class="task-info-value">${assigneeName}</span>
                    </div>
                    <div class="task-info-item">
                        <span class="task-info-label">Created</span>
                        <span class="task-info-value">${this.formatDate(task.createdAt)}</span>
                    </div>
                </div>
                
                <div class="task-description">
                    <h4>Description</h4>
                    <p>${task.description}</p>
                </div>
                
                ${task.mediaLinks.length > 0 ? `
                    <div class="task-media">
                        <h4>Media Links</h4>
                        <div class="media-links">
                            ${task.mediaLinks.map(link => `
                                <a href="${link}" target="_blank" class="media-link">
                                    <i class="fas fa-external-link-alt"></i>
                                    ${link}
                                </a>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        document.getElementById('taskDetailContent').innerHTML = content;
        document.getElementById('taskDetailModal').classList.add('active');
    }

    findTask(taskId) {
        if (!this.currentGame) return null;

        for (const category in this.currentGame.issues) {
            const task = this.currentGame.issues[category].find(t => t.id === taskId);
            if (task) return task;
        }
        return null;
    }

    // Statistics
    updateStatistics() {
        if (!this.currentGame) return;

        const allTasks = this.getFilteredTasks();
        const totalTasks = allTasks.length;
        const openTasks = allTasks.filter(t => t.status !== 'completed').length;
        const completedTasks = allTasks.filter(t => t.status === 'completed').length;

        document.getElementById('totalIssues').textContent = totalTasks;
        document.getElementById('openIssues').textContent = openTasks;
        document.getElementById('completedIssues').textContent = completedTasks;
    }

    // Filters
    populateFilters() {
        const assigneeFilter = document.getElementById('assigneeFilter');
        assigneeFilter.innerHTML = '<option value="all">All Assignees</option>';
        
        this.members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            assigneeFilter.appendChild(option);
        });
    }

    // Event Listeners
    setupEventListeners() {
        // Back button
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = 'Index.html';
        });

        // Add task button
        document.getElementById('addTaskBtn').addEventListener('click', () => {
            document.getElementById('addTaskModal').classList.add('active');
        });

        // Category navigation
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all buttons
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                e.target.closest('.category-btn').classList.add('active');
                
                this.currentCategory = e.target.closest('.category-btn').dataset.category;
                this.updateCategoryTitle();
                this.renderIssues();
            });
        });

        // Filters
        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.renderIssues();
            this.updateStatistics();
        });

        document.getElementById('priorityFilter').addEventListener('change', (e) => {
            this.filters.priority = e.target.value;
            this.renderIssues();
            this.updateStatistics();
        });

        document.getElementById('assigneeFilter').addEventListener('change', (e) => {
            this.filters.assignee = e.target.value;
            this.renderIssues();
            this.updateStatistics();
        });

        // Search
        document.getElementById('searchIssues').addEventListener('input', (e) => {
            this.searchTasks(e.target.value);
        });

        // Add task form
        document.getElementById('addTaskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddTask();
        });

        // Task category change
        document.getElementById('taskCategory').addEventListener('change', (e) => {
            this.updateTaskFormFields(e.target.value);
        });

        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('active');
            }
        });
    }

    updateCategoryTitle() {
        const titles = {
            'all': 'All Issues',
            'bug': 'Bugs',
            'controls': 'Controls',
            'quest': 'Quests',
            'review': 'Reviews'
        };
        document.getElementById('categoryTitle').textContent = titles[this.currentCategory] || 'All Issues';
    }

    updateTaskFormFields(category) {
        const priorityGroup = document.getElementById('priorityGroup');
        const urgencyGroup = document.getElementById('urgencyGroup');
        const assigneeGroup = document.getElementById('assigneeGroup');

        if (category === 'review') {
            priorityGroup.style.display = 'none';
            urgencyGroup.style.display = 'none';
            assigneeGroup.style.display = 'none';
        } else {
            priorityGroup.style.display = 'block';
            urgencyGroup.style.display = 'block';
            assigneeGroup.style.display = 'block';
        }
    }

    handleAddTask() {
        const formData = {
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            category: document.getElementById('taskCategory').value,
            priority: document.getElementById('taskPriority').value,
            urgency: document.getElementById('taskUrgency').value,
            assignee: document.getElementById('taskAssignee').value,
            mediaLinks: document.getElementById('taskMediaLinks').value
        };

        this.addTask(formData);
        this.closeModal('addTaskModal');
        document.getElementById('addTaskForm').reset();
    }

    searchTasks(query) {
        const tasks = document.querySelectorAll('.issue-card');
        const searchTerm = query.toLowerCase();

        tasks.forEach(task => {
            const title = task.querySelector('.issue-title').textContent.toLowerCase();
            const description = task.querySelector('.issue-description').textContent.toLowerCase();
            
            if (title.includes(searchTerm) || description.includes(searchTerm)) {
                task.style.display = 'block';
            } else {
                task.style.display = 'none';
            }
        });
    }

    // Utility functions
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }
}

// Global functions
function closeModal(modalId) {
    gameReview.closeModal(modalId);
}

// Initialize the game review system
const gameReview = new GameDesignReview();
