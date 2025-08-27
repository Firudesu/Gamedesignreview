// Game Design Review System - Task Management with GitHub Storage
class TaskManager {
    constructor() {
        this.currentGame = null;
        this.currentCategory = 'all';
        this.tasks = [];
        this.members = [];
        this.taskToDelete = null;
        this.currentTaskId = null; // Add missing property
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

        // Initialize deleted tasks array if it doesn't exist
        if (!this.currentGame.deletedTasks) {
            this.currentGame.deletedTasks = [];
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
            // Initialize form fields when modal opens
            this.updateTaskFormFields('bug');
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

        // Completion modal form
        document.getElementById('completionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.completeTaskWithComment();
        });

        // Comment modal form
        document.getElementById('commentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addComment();
        });

        // Delete modal form
        document.getElementById('deleteForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.confirmDeleteTask();
        });

        // Add team member form
        document.getElementById('addMemberForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTeamMember();
        });

        // Team management buttons
        document.getElementById('addMemberBtn').addEventListener('click', () => {
            console.log('Add member button clicked');
            this.showAddMemberModal();
        });

        document.getElementById('viewTeamMembersBtn').addEventListener('click', () => {
            console.log('View team members button clicked');
            this.showTeamMembers();
        });

        document.getElementById('viewDeletedTasksBtn').addEventListener('click', () => {
            console.log('View deleted tasks button clicked');
            this.showDeletedTasks();
        });

                 // Close modals when clicking outside
         document.addEventListener('click', (e) => {
             if (e.target.classList.contains('modal')) {
                 this.hideModal(e.target.id);
             }
             if (e.target.classList.contains('media-modal')) {
                 this.closeMediaModal();
             }
         });

                 // Event delegation for dynamically created task elements
         document.addEventListener('click', (e) => {
             // Task expansion
             if (e.target.closest('.task-summary')) {
                 const taskCard = e.target.closest('.task-card');
                 const taskId = taskCard.dataset.taskId;
                 this.toggleTaskExpansion(taskId);
             }
             
             // Task action buttons
             if (e.target.closest('.task-btn')) {
                 const button = e.target.closest('.task-btn');
                 const taskCard = button.closest('.task-card');
                 const taskId = taskCard.dataset.taskId;
                 
                 if (button.classList.contains('complete')) {
                     this.showCompletionModal(taskId);
                 } else if (button.classList.contains('comment')) {
                     this.showCommentModal(taskId);
                 } else if (button.classList.contains('delete')) {
                     this.showDeleteModal(taskId);
                 } else if (button.classList.contains('reopen')) {
                     this.toggleTaskComplete(taskId);
                 }
             }
             
             // Media item clicks
             if (e.target.closest('.media-item')) {
                 const mediaItem = e.target.closest('.media-item');
                 const mediaUrl = mediaItem.dataset.mediaUrl;
                 const mediaType = mediaItem.dataset.mediaType;
                 this.showMediaModal(mediaUrl, mediaType);
             }
             
             // Remove team member button
             if (e.target.closest('.btn-remove-member')) {
                 const button = e.target.closest('.btn-remove-member');
                 const memberId = button.dataset.memberId;
                 if (memberId) {
                     this.removeTeamMember(memberId);
                 }
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
             assignee: document.getElementById('taskAssignee').value,
             mediaLinks: document.getElementById('taskMediaLinks').value
         };

        try {
                         // Parse media links
             const mediaLinks = this.parseMediaLinks(formData.mediaLinks);
             
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
                 updatedAt: new Date().toISOString(),
                 comments: [],
                 completionComment: null,
                 completedBy: null,
                 mediaLinks: mediaLinks
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
        this.updateTaskFormFields('bug'); // Show fields by default
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
         const commentCount = task.comments ? task.comments.length : 0;
         const isExpanded = task.isExpanded || false;
         const mediaThumbnails = this.renderMediaThumbnails(task.mediaLinks);
        
        return `
            <div class="task-card ${task.status === 'completed' ? 'completed' : ''}" data-task-id="${task.id}">
                <!-- Summary View -->
                <div class="task-summary">
                    <div class="task-header">
                        <div class="task-title">${this.escapeHtml(task.title)}</div>
                        <div class="task-status-indicator">
                            ${task.status === 'completed' ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-circle"></i>'}
                        </div>
                    </div>
                                         <div class="task-meta">
                         ${priorityText ? `<span class="${priorityClass}">${priorityText}</span>` : ''}
                         ${assigneeName ? `<span class="task-assignee">Assigned to ${this.escapeHtml(assigneeName)}</span>` : ''}
                         ${commentCount > 0 ? `<span class="task-comments"><i class="fas fa-comments"></i> ${commentCount}</span>` : ''}
                         ${mediaThumbnails}
                         <span class="task-date">${new Date(task.createdAt).toLocaleDateString()}</span>
                     </div>
                    <div class="task-description-summary">
                        ${this.escapeHtml(task.description || 'No description').substring(0, 100)}${(task.description && task.description.length > 100) ? '...' : ''}
                    </div>
                    <div class="expand-indicator">
                        <i class="fas fa-chevron-${isExpanded ? 'up' : 'down'}"></i>
                    </div>
                </div>
                
                <!-- Expanded View -->
                <div class="task-expanded ${isExpanded ? 'expanded' : ''}" style="display: ${isExpanded ? 'block' : 'none'};">
                    <div class="task-full-description">
                        <h4>Full Description:</h4>
                        <p>${this.escapeHtml(task.description || 'No description')}</p>
                    </div>
                    
                    ${task.completionComment || task.completedBy ? `
                        <div class="completion-details">
                            <h4>Completion Details:</h4>
                            ${task.completedBy ? `<p><strong>Completed by:</strong> ${this.escapeHtml(task.completedBy)}</p>` : ''}
                            ${task.completionComment ? `<p><strong>Notes:</strong> ${this.escapeHtml(task.completionComment)}</p>` : ''}
                        </div>
                    ` : ''}
                    
                                         ${this.renderMediaSection(task.mediaLinks)}
                     
                     ${task.comments && task.comments.length > 0 ? `
                         <div class="task-comments-section">
                             <h4>Comments (${task.comments.length}):</h4>
                             ${task.comments.map(comment => `
                                 <div class="comment-item ${comment.status}">
                                     <div class="comment-header">
                                         <span class="comment-author">${this.escapeHtml(comment.author || 'Anonymous')}</span>
                                         <span class="comment-date">${new Date(comment.createdAt).toLocaleDateString()}</span>
                                         <span class="comment-status ${comment.status}">${comment.status}</span>
                                     </div>
                                     <div class="comment-text">${this.escapeHtml(comment.text)}</div>
                                 </div>
                             `).join('')}
                         </div>
                     ` : ''}
                    
                    <div class="task-actions">
                        ${task.status === 'open' ? 
                            `<button class="task-btn complete">
                                <i class="fas fa-check"></i> Complete
                            </button>` :
                            `<button class="task-btn reopen">
                                <i class="fas fa-undo"></i> Reopen
                            </button>`
                        }
                        <button class="task-btn comment">
                            <i class="fas fa-comment"></i> Comment
                        </button>
                        <button class="task-btn delete">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    toggleTaskExpansion(taskId) {
        // Find the task and toggle its expanded state
        for (const tasks of Object.values(this.currentGame.issues || {})) {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                task.isExpanded = !task.isExpanded;
                this.renderTasks(); // Re-render to show the change
                break;
            }
        }
    }

    showCompletionModal(taskId) {
        this.currentTaskId = taskId;
        this.showModal('completionModal');
    }

    async completeTaskWithComment() {
        const comment = document.getElementById('completionComment').value.trim();
        const completedById = document.getElementById('completionAuthor').value;
        
        if (!completedById) {
            this.showNotification('Please select a team member.', 'error');
            return;
        }
        
        const completedBy = this.members.find(m => m.id === completedById)?.name || 'Unknown';
        
        try {
            // Find the task in the current game
            let task = null;
            let category = null;
            
            for (const [cat, tasks] of Object.entries(this.currentGame.issues || {})) {
                const foundTask = tasks.find(t => t.id === this.currentTaskId);
                if (foundTask) {
                    task = foundTask;
                    category = cat;
                    break;
                }
            }
            
            if (task) {
                task.status = 'completed';
                task.updatedAt = new Date().toISOString();
                task.completionComment = comment;
                task.completedBy = completedBy;
                
                // Save to GitHub
                await this.saveData();
                
                // Update UI
                this.renderTasks();
                this.updateStatistics();
                this.hideModal('completionModal');
                document.getElementById('completionComment').value = '';
                document.getElementById('completionAuthor').value = '';
                
                this.showNotification('Task completed successfully!', 'success');
            }
        } catch (error) {
            console.error('Error completing task:', error);
            this.showNotification('Error completing task. Please try again.', 'error');
        }
    }

    showCommentModal(taskId) {
        this.currentTaskId = taskId;
        this.showModal('commentModal');
    }

    async addComment() {
        const commentText = document.getElementById('commentText').value.trim();
        const commentAuthorId = document.getElementById('commentAuthor').value;
        
        if (!commentText) {
            this.showNotification('Please enter a comment.', 'error');
            return;
        }
        
        if (!commentAuthorId) {
            this.showNotification('Please select a team member.', 'error');
            return;
        }
        
        const commentAuthor = this.members.find(m => m.id === commentAuthorId)?.name || 'Unknown';
        
        try {
            // Find the task in the current game
            let task = null;
            
            for (const tasks of Object.values(this.currentGame.issues || {})) {
                const foundTask = tasks.find(t => t.id === this.currentTaskId);
                if (foundTask) {
                    task = foundTask;
                    break;
                }
            }
            
            if (task) {
                if (!task.comments) {
                    task.comments = [];
                }
                
                const comment = {
                    id: Date.now().toString(),
                    text: commentText,
                    author: commentAuthor,
                    createdAt: new Date().toISOString(),
                    status: 'open' // open, resolved, closed
                };
                
                task.comments.push(comment);
                task.updatedAt = new Date().toISOString();
                
                // Save to GitHub
                await this.saveData();
                
                // Update UI
                this.renderTasks();
                this.hideModal('commentModal');
                document.getElementById('commentText').value = '';
                document.getElementById('commentAuthor').value = '';
                
                this.showNotification('Comment added successfully!', 'success');
            }
        } catch (error) {
            console.error('Error adding comment:', error);
            this.showNotification('Error adding comment. Please try again.', 'error');
        }
    }

    showDeleteModal(taskId) {
        this.currentTaskId = taskId;
        
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
        const deleteReason = document.getElementById('deleteReason').value.trim();
        const deletedById = document.getElementById('deleteAuthor').value;
        
        if (!deleteReason) {
            this.showNotification('Please provide a reason for deletion.', 'error');
            return;
        }
        
        if (!deletedById) {
            this.showNotification('Please select a team member.', 'error');
            return;
        }
        
        const deletedBy = this.members.find(m => m.id === deletedById)?.name || 'Unknown';
        
        if (this.currentTaskId) {
            try {
                // Find the task to be deleted
                let taskToDelete = null;
                let category = null;
                
                for (const [cat, tasks] of Object.entries(this.currentGame.issues || {})) {
                    const foundTask = tasks.find(t => t.id === this.currentTaskId);
                    if (foundTask) {
                        taskToDelete = foundTask;
                        category = cat;
                        break;
                    }
                }
                
                if (taskToDelete) {
                    // Add to deleted tasks with reason
                    const deletedTask = {
                        ...taskToDelete,
                        deletedAt: new Date().toISOString(),
                        deletedBy: deletedBy,
                        deleteReason: deleteReason
                    };
                    
                    this.currentGame.deletedTasks.push(deletedTask);
                    
                    // Remove from active tasks
                    const index = this.currentGame.issues[category].findIndex(t => t.id === this.currentTaskId);
                    if (index !== -1) {
                        this.currentGame.issues[category].splice(index, 1);
                    }
                    
                    // Save to GitHub
                    await this.saveData();
                    
                    // Update UI
                    this.renderTasks();
                    this.updateStatistics();
                    this.hideModal('deleteTaskModal');
                    document.getElementById('deleteReason').value = '';
                    document.getElementById('deleteAuthor').value = '';
                    
                    this.showNotification('Task deleted successfully!', 'success');
                }
            } catch (error) {
                console.error('Error deleting task:', error);
                this.showNotification('Error deleting task. Please try again.', 'error');
            }
        }
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
                
                // Clear completion details if reopening
                if (task.status === 'open') {
                    task.completionComment = null;
                    task.completedBy = null;
                }
                
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
        
        // Populate all member dropdowns
        this.populateMemberDropdowns();
    }

    populateMemberDropdowns() {
        const memberDropdowns = [
            'completionAuthor',
            'commentAuthor', 
            'deleteAuthor'
        ];
        
        memberDropdowns.forEach(dropdownId => {
            const dropdown = document.getElementById(dropdownId);
            if (dropdown) {
                dropdown.innerHTML = '<option value="">Select team member...</option>';
                this.members.forEach(member => {
                    dropdown.innerHTML += `<option value="${member.id}">${this.escapeHtml(member.name)}</option>`;
                });
            }
        });
    }

    showAddMemberModal() {
        console.log('showAddMemberModal called');
        this.showModal('addMemberModal');
    }

    async addTeamMember() {
        const memberName = document.getElementById('memberName').value.trim();
        const memberRole = document.getElementById('memberRole').value.trim();
        
        if (!memberName) {
            this.showNotification('Please enter a member name.', 'error');
            return;
        }
        
        try {
            const member = {
                id: Date.now().toString(),
                name: memberName,
                role: memberRole || null,
                createdAt: new Date().toISOString()
            };
            
            this.members.push(member);
            
            // Save to GitHub
            await this.storage.saveMembers(this.members);
            
            // Update UI
            this.populateFilters();
            this.hideModal('addMemberModal');
            document.getElementById('memberName').value = '';
            document.getElementById('memberRole').value = '';
            
            this.showNotification('Team member added successfully!', 'success');
        } catch (error) {
            console.error('Error adding team member:', error);
            this.showNotification('Error adding team member. Please try again.', 'error');
        }
    }

    showTeamMembers() {
        console.log('showTeamMembers called');
        const teamMembersList = document.getElementById('teamMembersList');
        
        if (!this.members || this.members.length === 0) {
            teamMembersList.innerHTML = '<p style="text-align: center; color: #64748b; padding: 2rem;">No team members found. Add your first team member to get started.</p>';
        } else {
            const teamMembersHtml = this.members.map(member => `
                <div class="team-member-item">
                    <div class="team-member-info">
                        <h4>${this.escapeHtml(member.name)}</h4>
                        ${member.role ? `<div class="team-member-role">${this.escapeHtml(member.role)}</div>` : ''}
                    </div>
                    <div class="team-member-actions">
                        <button class="btn-remove-member" data-member-id="${member.id}">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                </div>
            `).join('');
            
            teamMembersList.innerHTML = teamMembersHtml;
        }
        
        this.showModal('teamMembersModal');
    }

    async removeTeamMember(memberId) {
        if (confirm('Are you sure you want to remove this team member? This action cannot be undone.')) {
            try {
                // Remove member from array
                const index = this.members.findIndex(m => m.id === memberId);
                if (index !== -1) {
                    this.members.splice(index, 1);
                    
                    // Save to GitHub
                    await this.storage.saveMembers(this.members);
                    
                    // Update UI
                    this.populateFilters();
                    this.showTeamMembers(); // Refresh the modal
                    
                    this.showNotification('Team member removed successfully!', 'success');
                }
            } catch (error) {
                console.error('Error removing team member:', error);
                this.showNotification('Error removing team member. Please try again.', 'error');
            }
        }
    }

    showDeletedTasks() {
        console.log('showDeletedTasks called');
        const deletedTasksList = document.getElementById('deletedTasksList');
        
        if (!this.currentGame.deletedTasks || this.currentGame.deletedTasks.length === 0) {
            deletedTasksList.innerHTML = '<p style="text-align: center; color: #64748b; padding: 2rem;">No deleted tasks found.</p>';
        } else {
            const deletedTasksHtml = this.currentGame.deletedTasks.map(task => `
                <div class="deleted-task-item">
                    <div class="deleted-task-header">
                        <h4>${this.escapeHtml(task.title)}</h4>
                        <span class="deleted-date">Deleted: ${new Date(task.deletedAt).toLocaleDateString()}</span>
                    </div>
                    <div class="deleted-task-details">
                        <p><strong>Category:</strong> ${task.category}</p>
                        <p><strong>Description:</strong> ${this.escapeHtml(task.description || 'No description')}</p>
                        <p><strong>Deleted by:</strong> ${this.escapeHtml(task.deletedBy)}</p>
                        <p><strong>Reason:</strong> ${this.escapeHtml(task.deleteReason)}</p>
                        ${task.comments && task.comments.length > 0 ? `
                            <p><strong>Comments:</strong> ${task.comments.length} comment(s)</p>
                        ` : ''}
                    </div>
                </div>
            `).join('');
            
            deletedTasksList.innerHTML = deletedTasksHtml;
        }
        
        this.showModal('deletedTasksModal');
    }

    showModal(modalId) {
        console.log('showModal called with:', modalId);
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            console.log('Modal activated:', modalId);
        } else {
            console.error('Modal not found:', modalId);
        }
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

         parseMediaLinks(mediaLinksText) {
         if (!mediaLinksText || !mediaLinksText.trim()) {
             return [];
         }
         
         const lines = mediaLinksText.trim().split('\n');
         const mediaLinks = [];
         
         lines.forEach(line => {
             const url = line.trim();
             if (url) {
                 const mediaType = this.getMediaType(url);
                 if (mediaType) {
                     mediaLinks.push({
                         url: url,
                         type: mediaType
                     });
                 }
             }
         });
         
         return mediaLinks;
     }
     
     getMediaType(url) {
         const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
         const lowerUrl = url.toLowerCase();
         
         // Check for image extensions
         if (imageExtensions.some(ext => lowerUrl.includes(ext))) {
             return 'image';
         }
         
         // Check for YouTube videos
         if (lowerUrl.includes('youtube.com/watch') || lowerUrl.includes('youtu.be/')) {
             return 'video';
         }
         
         return null;
     }
     
     getYouTubeEmbedUrl(url) {
         let videoId = '';
         
         if (url.includes('youtube.com/watch')) {
             const urlParams = new URLSearchParams(url.split('?')[1]);
             videoId = urlParams.get('v');
         } else if (url.includes('youtu.be/')) {
             videoId = url.split('youtu.be/')[1];
         }
         
         return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
     }
     
     renderMediaSection(mediaLinks) {
         if (!mediaLinks || mediaLinks.length === 0) {
             return '';
         }
         
         const mediaItems = mediaLinks.map(media => {
             if (media.type === 'image') {
                 return `
                     <div class="media-item" data-media-url="${this.escapeHtml(media.url)}" data-media-type="image">
                         <img src="${this.escapeHtml(media.url)}" alt="Task media" onerror="this.style.display='none'">
                     </div>
                 `;
             } else if (media.type === 'video') {
                 return `
                     <div class="media-item video" data-media-url="${this.escapeHtml(media.url)}" data-media-type="video">
                     </div>
                 `;
             }
             return '';
         }).join('');
         
         return `
             <div class="task-media-section">
                 <h4>Media (${mediaLinks.length})</h4>
                 <div class="media-grid">
                     ${mediaItems}
                 </div>
             </div>
         `;
     }
     
     renderMediaThumbnails(mediaLinks) {
         if (!mediaLinks || mediaLinks.length === 0) {
             return '';
         }
         
         const imageCount = mediaLinks.filter(m => m.type === 'image').length;
         const videoCount = mediaLinks.filter(m => m.type === 'video').length;
         
         let thumbnailHtml = '';
         
         // Show first image as thumbnail if available
         const firstImage = mediaLinks.find(m => m.type === 'image');
         if (firstImage) {
             thumbnailHtml += `<img src="${this.escapeHtml(firstImage.url)}" class="media-thumbnail" alt="Media thumbnail">`;
         }
         
         // Show count
         if (imageCount > 0 || videoCount > 0) {
             thumbnailHtml += `<span class="media-count">`;
             if (imageCount > 0) {
                 thumbnailHtml += `${imageCount} image${imageCount > 1 ? 's' : ''}`;
             }
             if (videoCount > 0) {
                 if (imageCount > 0) thumbnailHtml += ', ';
                 thumbnailHtml += `${videoCount} video${videoCount > 1 ? 's' : ''}`;
             }
             thumbnailHtml += `</span>`;
         }
         
         return thumbnailHtml;
     }
     
     showMediaModal(mediaUrl, mediaType) {
         const modalContent = document.getElementById('mediaModalContent');
         
         if (mediaType === 'image') {
             modalContent.innerHTML = `<img src="${this.escapeHtml(mediaUrl)}" alt="Full size image">`;
         } else if (mediaType === 'video') {
             const embedUrl = this.getYouTubeEmbedUrl(mediaUrl);
             if (embedUrl) {
                 modalContent.innerHTML = `<iframe src="${this.escapeHtml(embedUrl)}" allowfullscreen></iframe>`;
             } else {
                 modalContent.innerHTML = `<p style="color: white;">Invalid video URL</p>`;
             }
         }
         
         document.getElementById('mediaModal').classList.add('active');
     }
     
     closeMediaModal() {
         document.getElementById('mediaModal').classList.remove('active');
         document.getElementById('mediaModalContent').innerHTML = '';
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
 
 function closeMediaModal() {
     if (window.taskManager) {
         window.taskManager.closeMediaModal();
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
