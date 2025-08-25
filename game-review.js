// Game Design Review System - Task Management with GitHub Storage
class TaskManager {
    constructor() {
        this.currentGame = null;
        this.currentCategory = 'all';
        this.tasks = [];
        this.members = [];
        this.taskToDelete = null;
        this.storage = new GitHubStorage();
        
        this.init();
    }

    async init() {
        console.log('Initializing TaskManager...');
        
        // Get current game ID from localStorage
        const gameId = localStorage.getItem('currentGameId');
        if (!gameId) {
            console.error('No game ID found, redirecting to main page');
            window.location.href = 'Index.html';
            return;
        }

        // Load data from GitHub
        await this.loadData();
        
        // Find current game
        this.currentGame = this.games.find(g => g.id === gameId);
        if (!this.currentGame) {
            console.error('Game not found, redirecting to main page');
            window.location.href = 'Index.html';
            return;
        }

        // Update UI
        this.updateGameTitle();
        this.setupEventListeners();
        this.renderTasks();
        this.updateStatistics();
        this.populateFilters();
        
        console.log('TaskManager initialized successfully');
    }

    async loadData() {
        try {
            // Load games and members from GitHub
            const [games, members] = await Promise.all([
                this.storage.loadGames(),
                this.storage.loadMembers()
            ]);
            
            this.games = games;
            this.members = members;
        } catch (error) {
            console.error('Error loading data:', error);
            this.showNotification('Error loading data. Check your GitHub token and repository settings.', 'error');
        }
    }

    async saveData() {
        try {
            // Save games to GitHub
            await this.storage.saveGames(this.games);
        } catch (error) {
            console.error('Error saving data:', error);
            this.showNotification('Error saving data. Please try again.', 'error');
        }
    }

    updateGameTitle() {
        const gameTitle = document.getElementById('gameTitle');
        if (gameTitle && this.currentGame) {
            gameTitle.textContent = this.currentGame.name;
        }
    }

    setupEventListeners() {
        // Back button
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = 'Index.html';
        });

        // Add task button
        document.getElementById('addTaskBtn').addEventListener('click', () => {
            this.showModal('addTaskModal');
        });

        // Add task form
        document.getElementById('addTaskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createTask();
        });

        // Category navigation
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                this.setCurrentCategory(category);
            });
        });

        // Task category change handler
        document.getElementById('taskCategory').addEventListener('change', (e) => {
            this.updateTaskFormFields(e.target.value);
        });

        // Task action buttons
        document.getElementById('markCompleteBtn').addEventListener('click', () => {
            this.toggleTaskComplete();
        });

        document.getElementById('reopenTaskBtn').addEventListener('click', () => {
            this.toggleTaskComplete();
        });

        document.getElementById('deleteTaskBtn').addEventListener('click', () => {
            this.deleteTask();
        });

        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModal(e.target.id);
            }
        });
    }

    setCurrentCategory(category) {
        this.currentCategory = category;
        
        // Update active button
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        // Update category title
        const categoryTitle = document.getElementById('categoryTitle');
        const categoryNames = {
            'all': 'All Issues',
            'bug': 'Bugs',
            'controls': 'Controls',
            'quest': 'Quests',
            'review': 'Reviews'
        };
        categoryTitle.textContent = categoryNames[category] || 'All Issues';
        
        this.renderTasks();
    }

    updateTaskFormFields(category) {
        const priorityGroup = document.getElementById('priorityGroup');
        const urgencyGroup = document.getElementById('urgencyGroup');
        const assigneeGroup = document.getElementById('assigneeGroup');
        
        // Show/hide fields based on category
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

    async createTask() {
        const formData = {
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            category: document.getElementById('taskCategory').value,
            priority: document.getElementById('taskPriority').value,
            urgency: document.getElementById('taskUrgency').value,
            assignee: document.getElementById('taskAssignee').value
        };

        try {
            const task = {
                id: Date.now().toString(),
                title: formData.title,
                description: formData.description,
                category: formData.category,
                priority: formData.category === 'review' ? null : formData.priority,
                urgency: formData.category === 'review' ? null : formData.urgency,
                assignee: formData.category === 'review' ? null : formData.assignee,
                status: 'open',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Add task to current game
            if (!this.currentGame.issues) {
                this.currentGame.issues = {
                    bug: [],
                    controls: [],
                    quest: [],
                    review: []
                };
            }

            this.currentGame.issues[task.category].push(task);
            
            // Save to GitHub
            await this.saveData();
            
            // Update UI
            this.renderTasks();
            this.updateStatistics();
            this.hideModal('addTaskModal');
            this.resetTaskForm();
            this.showNotification('Task created successfully!', 'success');
        } catch (error) {
            console.error('Error creating task:', error);
            this.showNotification('Error creating task. Please try again.', 'error');
        }
    }

    resetTaskForm() {
        document.getElementById('addTaskForm').reset();
        this.updateTaskFormFields('bug');
    }

    renderTasks() {
        const container = document.getElementById('tasksContainer');
        const emptyState = document.getElementById('emptyState');
        
        let tasks = [];
        
        if (this.currentCategory === 'all') {
            // Get all tasks from all categories
            Object.values(this.currentGame.issues || {}).forEach(categoryTasks => {
                tasks = tasks.concat(categoryTasks);
            });
        } else {
            // Get tasks from specific category
            tasks = this.currentGame.issues?.[this.currentCategory] || [];
        }

        // Sort tasks by priority, urgency, and creation date
        tasks.sort((a, b) => {
            // First by status (open tasks first)
            if (a.status !== b.status) {
                return a.status === 'open' ? -1 : 1;
            }
            
            // Then by priority (if available)
            if (a.priority && b.priority) {
                const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                    return priorityOrder[b.priority] - priorityOrder[a.priority];
                }
            }
            
            // Then by urgency (if available)
            if (a.urgency && b.urgency) {
                const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
                    return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
                }
            }
            
            // Finally by creation date (newest first)
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        if (tasks.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
        } else {
            container.style.display = 'block';
            emptyState.style.display = 'none';
            
            container.innerHTML = tasks.map(task => this.renderTaskCard(task)).join('');
        }
    }

    renderTaskCard(task) {
        const priorityClass = task.priority ? `task-priority ${task.priority}` : '';
        const priorityText = task.priority ? task.priority.toUpperCase() : '';
        const assigneeName = task.assignee ? this.members.find(m => m.id === task.assignee)?.name : null;
        
        return `
            <div class="task-card ${task.status === 'completed' ? 'completed' : ''}" onclick="taskManager.openTaskDetail('${task.id}')">
                <div class="task-header">
                    <div class="task-title">${this.escapeHtml(task.title)}</div>
                </div>
                <div class="task-meta">
                    ${priorityText ? `<span class="${priorityClass}">${priorityText}</span>` : ''}
                    ${assigneeName ? `<span class="task-assignee">Assigned to ${this.escapeHtml(assigneeName)}</span>` : ''}
                </div>
                <div class="task-description">${this.escapeHtml(task.description || 'No description')}</div>
                <div class="task-actions">
                    ${task.status === 'open' ? 
                        `<button class="task-btn complete" onclick="event.stopPropagation(); taskManager.toggleTaskComplete('${task.id}')">
                            <i class="fas fa-check"></i> Complete
                        </button>` :
                        `<button class="task-btn reopen" onclick="event.stopPropagation(); taskManager.toggleTaskComplete('${task.id}')">
                            <i class="fas fa-undo"></i> Reopen
                        </button>`
                    }
                    <button class="task-btn delete" onclick="event.stopPropagation(); taskManager.deleteTask('${task.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }

    async toggleTaskComplete(taskId) {
        try {
            // Find the task in the current game
            let task = null;
            let category = null;
            
            for (const [cat, tasks] of Object.entries(this.currentGame.issues || {})) {
                const foundTask = tasks.find(t => t.id === taskId);
                if (foundTask) {
                    task = foundTask;
                    category = cat;
                    break;
                }
            }
            
            if (task) {
                task.status = task.status === 'completed' ? 'open' : 'completed';
                task.updatedAt = new Date().toISOString();
                
                // Save to GitHub
                await this.saveData();
                
                // Update UI
                this.renderTasks();
                this.updateStatistics();
                
                this.showNotification(
                    task.status === 'completed' ? 'Task marked as completed!' : 'Task reopened!', 
                    'success'
                );
            }
        } catch (error) {
            console.error('Error toggling task completion:', error);
            this.showNotification('Error updating task. Please try again.', 'error');
        }
    }

    openTaskDetail(taskId) {
        // Find the task
        let task = null;
        
        for (const tasks of Object.values(this.currentGame.issues || {})) {
            const foundTask = tasks.find(t => t.id === taskId);
            if (foundTask) {
                task = foundTask;
                break;
            }
        }
        
        if (task) {
            // Update modal content
            document.getElementById('detailTaskTitle').textContent = task.title;
            document.getElementById('detailTaskStatus').textContent = task.status;
            document.getElementById('detailTaskPriority').textContent = task.priority || 'N/A';
            document.getElementById('detailTaskAssignee').textContent = 
                task.assignee ? this.members.find(m => m.id === task.assignee)?.name || 'Unknown' : 'Unassigned';
            document.getElementById('detailTaskDescription').textContent = task.description || 'No description';
            
            // Show/hide action buttons based on task status
            const markCompleteBtn = document.getElementById('markCompleteBtn');
            const reopenTaskBtn = document.getElementById('reopenTaskBtn');
            
            if (task.status === 'open') {
                markCompleteBtn.style.display = 'inline-flex';
                reopenTaskBtn.style.display = 'none';
            } else {
                markCompleteBtn.style.display = 'none';
                reopenTaskBtn.style.display = 'inline-flex';
            }
            
            // Store current task ID for actions
            this.currentTaskId = taskId;
            
            this.showModal('taskDetailModal');
        }
    }

    async deleteTask(taskId) {
        this.taskToDelete = taskId;
        
        // Find the task to get its name
        let taskName = 'Unknown Task';
        for (const tasks of Object.values(this.currentGame.issues || {})) {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                taskName = task.title;
                break;
            }
        }
        
        document.getElementById('deleteTaskName').textContent = taskName;
        this.showModal('deleteTaskModal');
    }

    async confirmDeleteTask() {
        if (this.taskToDelete) {
            try {
                // Remove task from current game
                for (const [category, tasks] of Object.entries(this.currentGame.issues || {})) {
                    const index = tasks.findIndex(t => t.id === this.taskToDelete);
                    if (index !== -1) {
                        tasks.splice(index, 1);
                        break;
                    }
                }
                
                // Save to GitHub
                await this.saveData();
                
                // Update UI
                this.renderTasks();
                this.updateStatistics();
                this.hideModal('deleteTaskModal');
                this.showNotification('Task deleted successfully!', 'success');
                this.taskToDelete = null;
            } catch (error) {
                console.error('Error deleting task:', error);
                this.showNotification('Error deleting task. Please try again.', 'error');
            }
        }
    }

    updateStatistics() {
        let totalTasks = 0;
        let openTasks = 0;
        let completedTasks = 0;
        
        // Count tasks from all categories
        Object.values(this.currentGame.issues || {}).forEach(categoryTasks => {
            totalTasks += categoryTasks.length;
            categoryTasks.forEach(task => {
                if (task.status === 'completed') {
                    completedTasks++;
                } else {
                    openTasks++;
                }
            });
        });
        
        document.getElementById('totalTasks').textContent = totalTasks;
        document.getElementById('openTasks').textContent = openTasks;
        document.getElementById('completedTasks').textContent = completedTasks;
    }

    populateFilters() {
        const assigneeSelect = document.getElementById('taskAssignee');
        if (assigneeSelect) {
            assigneeSelect.innerHTML = '<option value="">Unassigned</option>';
            this.members.forEach(member => {
                assigneeSelect.innerHTML += `<option value="${member.id}">${this.escapeHtml(member.name)}</option>`;
            });
        }
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global functions
function closeModal(modalId) {
    if (window.taskManager) {
        window.taskManager.hideModal(modalId);
    }
}

// Initialize the application
let taskManager;
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing TaskManager...');
    
    try {
        // Check if the class exists
        if (typeof TaskManager === 'undefined') {
            console.error('TaskManager class not found!');
            return;
        }
        
        console.log('TaskManager class found, creating instance...');
        
        // Initialize the task manager
        window.taskManager = new TaskManager();
        
        console.log('TaskManager initialization complete');
    } catch (error) {
        console.error('Error during TaskManager initialization:', error);
    }
});
