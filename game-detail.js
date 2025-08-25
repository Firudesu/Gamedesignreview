// Game Detail Page Logic
class GameDetail {
    constructor() {
        this.gameId = null;
        this.game = null;
        this.issues = [];
        this.members = [];
        this.currentCategory = 'all';
        this.currentIssue = null;
        this.init();
    }

    async init() {
        // Get game ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        this.gameId = parseInt(urlParams.get('id'));

        if (!this.gameId) {
            alert('No game ID provided');
            window.location.href = 'index.html';
            return;
        }

        // Initialize database
        await db.init();

        // Load data
        await this.loadGame();
        await this.loadMembers();
        await this.loadIssues();

        // Set up event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Back button
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = 'index.html';
        });

        // Add Issue button
        document.getElementById('addIssueBtn').addEventListener('click', () => {
            this.showAddIssueModal();
        });

        // Category tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterByCategory(e.target.dataset.category);
            });
        });

        // Add Issue form submission
        document.getElementById('addIssueForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.addIssue();
        });

        // Category change in form
        document.getElementById('issueCategory').addEventListener('change', (e) => {
            this.toggleUrgencyField(e.target.value);
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

    async loadGame() {
        this.game = await db.getGame(this.gameId);
        if (!this.game) {
            alert('Game not found');
            window.location.href = 'index.html';
            return;
        }
        document.getElementById('gameTitle').textContent = this.game.name;
    }

    async loadMembers() {
        this.members = await db.getMembers();
        this.populateAssigneeDropdown();
    }

    async loadIssues() {
        this.issues = await db.getIssuesByGame(this.gameId);
        this.renderIssues();
    }

    populateAssigneeDropdown() {
        const assigneeSelect = document.getElementById('issueAssignee');
        assigneeSelect.innerHTML = '<option value="">Unassigned</option>';
        
        this.members.forEach(member => {
            assigneeSelect.innerHTML += `
                <option value="${member.id}">${this.escapeHtml(member.name)} (${member.role})</option>
            `;
        });
    }

    renderIssues() {
        const issuesList = document.getElementById('issuesList');
        let filteredIssues = this.issues;

        // Filter by category
        if (this.currentCategory !== 'all') {
            filteredIssues = this.issues.filter(issue => issue.category === this.currentCategory);
        }

        // Sort issues by urgency (excluding reviews)
        filteredIssues.sort((a, b) => {
            // Reviews always go to the bottom
            if (a.category === 'review' && b.category !== 'review') return 1;
            if (a.category !== 'review' && b.category === 'review') return -1;
            if (a.category === 'review' && b.category === 'review') return 0;

            // Sort by urgency
            const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        });

        if (filteredIssues.length === 0) {
            issuesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <p>No issues found</p>
                    <p class="text-muted">Create a new issue to get started</p>
                </div>
            `;
            return;
        }

        issuesList.innerHTML = filteredIssues.map(issue => `
            <div class="issue-card ${issue.status}" data-issue-id="${issue.id}">
                <div class="issue-header">
                    <div class="issue-title-row">
                        <h4>${this.escapeHtml(issue.title)}</h4>
                        ${issue.category !== 'review' ? `
                            <span class="urgency-badge urgency-${issue.urgency}">
                                ${issue.urgency.toUpperCase()}
                            </span>
                        ` : ''}
                    </div>
                    <div class="issue-meta">
                        <span class="category-badge category-${issue.category}">
                            ${this.getCategoryIcon(issue.category)} ${issue.category}
                        </span>
                        <span class="status-badge">${this.formatStatus(issue.status)}</span>
                        ${issue.assigneeId ? `<span class="assignee">
                            <i class="fas fa-user"></i> ${this.getAssigneeName(issue.assigneeId)}
                        </span>` : ''}
                    </div>
                </div>
                <div class="issue-body">
                    <p>${this.escapeHtml(issue.description).substring(0, 200)}${issue.description.length > 200 ? '...' : ''}</p>
                    ${issue.mediaLinks && issue.mediaLinks.length > 0 ? `
                        <div class="media-links">
                            <i class="fas fa-link"></i> ${issue.mediaLinks.length} media link${issue.mediaLinks.length > 1 ? 's' : ''}
                        </div>
                    ` : ''}
                </div>
                <div class="issue-footer">
                    <span class="date">Created ${this.formatDate(issue.createdAt)}</span>
                    <div class="issue-actions">
                        <button class="btn-icon view-issue" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon edit-issue" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-issue" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners
        issuesList.querySelectorAll('.view-issue').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const issueId = parseInt(e.target.closest('.issue-card').dataset.issueId);
                await this.viewIssue(issueId);
            });
        });

        issuesList.querySelectorAll('.edit-issue').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const issueId = parseInt(e.target.closest('.issue-card').dataset.issueId);
                await this.editIssue(issueId);
            });
        });

        issuesList.querySelectorAll('.delete-issue').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const issueId = parseInt(e.target.closest('.issue-card').dataset.issueId);
                await this.deleteIssue(issueId);
            });
        });
    }

    filterByCategory(category) {
        this.currentCategory = category;
        
        // Update active tab
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });

        this.renderIssues();
    }

    showAddIssueModal() {
        this.showModal('addIssueModal');
        this.toggleUrgencyField(''); // Reset urgency field
    }

    toggleUrgencyField(category) {
        const urgencyGroup = document.getElementById('urgencyGroup');
        if (category === 'review') {
            urgencyGroup.style.display = 'none';
            document.getElementById('issueUrgency').removeAttribute('required');
        } else {
            urgencyGroup.style.display = 'block';
            document.getElementById('issueUrgency').setAttribute('required', 'required');
        }
    }

    async addIssue() {
        const form = document.getElementById('addIssueForm');
        const category = form.issueCategory.value;
        
        const issueData = {
            gameId: this.gameId,
            title: form.issueTitle.value.trim(),
            category: category,
            urgency: category === 'review' ? 'low' : form.issueUrgency.value,
            description: form.issueDescription.value.trim(),
            assigneeId: form.issueAssignee.value || null,
            status: form.issueStatus.value,
            mediaLinks: this.parseMediaLinks(form.issueMediaLinks.value)
        };

        if (!issueData.title || !issueData.category || !issueData.description) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            await db.addIssue(issueData);
            this.hideModal('addIssueModal');
            form.reset();
            await this.loadIssues();
            this.showNotification('Issue created successfully!', 'success');
        } catch (error) {
            console.error('Error adding issue:', error);
            this.showNotification('Error creating issue', 'error');
        }
    }

    async viewIssue(issueId) {
        const issue = await db.getIssue(issueId);
        this.currentIssue = issue;

        const content = document.getElementById('viewIssueContent');
        content.innerHTML = `
            <div class="issue-detail">
                <div class="issue-detail-header">
                    <div class="category-badge category-${issue.category}">
                        ${this.getCategoryIcon(issue.category)} ${issue.category}
                    </div>
                    ${issue.category !== 'review' ? `
                        <span class="urgency-badge urgency-${issue.urgency}">
                            ${issue.urgency.toUpperCase()}
                        </span>
                    ` : ''}
                    <span class="status-badge">${this.formatStatus(issue.status)}</span>
                </div>

                <h2>${this.escapeHtml(issue.title)}</h2>

                <div class="issue-detail-meta">
                    ${issue.assigneeId ? `
                        <div class="meta-item">
                            <strong>Assignee:</strong> ${this.getAssigneeName(issue.assigneeId)}
                        </div>
                    ` : ''}
                    <div class="meta-item">
                        <strong>Created:</strong> ${this.formatDate(issue.createdAt)}
                    </div>
                    <div class="meta-item">
                        <strong>Updated:</strong> ${this.formatDate(issue.updatedAt)}
                    </div>
                </div>

                <div class="issue-detail-description">
                    <h3>Description</h3>
                    <p>${this.escapeHtml(issue.description).replace(/\n/g, '<br>')}</p>
                </div>

                ${issue.mediaLinks && issue.mediaLinks.length > 0 ? `
                    <div class="issue-detail-media">
                        <h3>Media Links</h3>
                        <div class="media-links-list">
                            ${issue.mediaLinks.map(link => this.renderMediaLink(link)).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="issue-detail-actions">
                    <button class="btn btn-secondary" onclick="gameDetail.editIssue(${issue.id})">
                        <i class="fas fa-edit"></i> Edit Issue
                    </button>
                    <button class="btn btn-danger" onclick="gameDetail.deleteIssue(${issue.id})">
                        <i class="fas fa-trash"></i> Delete Issue
                    </button>
                </div>
            </div>
        `;

        this.showModal('viewIssueModal');
    }

    async editIssue(issueId) {
        // For simplicity, using prompts. In a real app, you'd reuse the add modal
        const issue = await db.getIssue(issueId);
        const newStatus = prompt('Update status (open/in-progress/review/closed):', issue.status);
        
        if (newStatus && ['open', 'in-progress', 'review', 'closed'].includes(newStatus)) {
            try {
                await db.updateIssue(issueId, { status: newStatus });
                await this.loadIssues();
                this.hideModal('viewIssueModal');
                this.showNotification('Issue updated successfully!', 'success');
            } catch (error) {
                console.error('Error updating issue:', error);
                this.showNotification('Error updating issue', 'error');
            }
        }
    }

    async deleteIssue(issueId) {
        if (confirm('Are you sure you want to delete this issue?')) {
            try {
                await db.deleteIssue(issueId);
                await this.loadIssues();
                this.hideModal('viewIssueModal');
                this.showNotification('Issue deleted successfully!', 'success');
            } catch (error) {
                console.error('Error deleting issue:', error);
                this.showNotification('Error deleting issue', 'error');
            }
        }
    }

    parseMediaLinks(text) {
        if (!text.trim()) return [];
        return text.split('\n')
            .map(link => link.trim())
            .filter(link => link.length > 0);
    }

    renderMediaLink(link) {
        // Detect link type and render appropriately
        if (link.includes('youtube.com') || link.includes('youtu.be')) {
            return `
                <div class="media-link youtube">
                    <i class="fab fa-youtube"></i>
                    <a href="${link}" target="_blank" rel="noopener">YouTube Video</a>
                </div>
            `;
        } else if (link.includes('drive.google.com')) {
            return `
                <div class="media-link google-drive">
                    <i class="fab fa-google-drive"></i>
                    <a href="${link}" target="_blank" rel="noopener">Google Drive File</a>
                </div>
            `;
        } else if (link.includes('imgur.com')) {
            return `
                <div class="media-link imgur">
                    <i class="fas fa-image"></i>
                    <a href="${link}" target="_blank" rel="noopener">Imgur Image</a>
                </div>
            `;
        } else {
            return `
                <div class="media-link generic">
                    <i class="fas fa-link"></i>
                    <a href="${link}" target="_blank" rel="noopener">${link}</a>
                </div>
            `;
        }
    }

    getCategoryIcon(category) {
        const icons = {
            bug: '<i class="fas fa-bug"></i>',
            controls: '<i class="fas fa-gamepad"></i>',
            quest: '<i class="fas fa-scroll"></i>',
            review: '<i class="fas fa-star"></i>'
        };
        return icons[category] || '<i class="fas fa-tag"></i>';
    }

    getAssigneeName(assigneeId) {
        const member = this.members.find(m => m.id == assigneeId);
        return member ? member.name : 'Unknown';
    }

    formatStatus(status) {
        return status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
            if (diffHours === 0) {
                const diffMinutes = Math.floor(diffTime / (1000 * 60));
                return `${diffMinutes} minutes ago`;
            }
            return `${diffHours} hours ago`;
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
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
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);

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

// Initialize the app and make it globally accessible
let gameDetail;
document.addEventListener('DOMContentLoaded', () => {
    gameDetail = new GameDetail();
});