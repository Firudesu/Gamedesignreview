// Game Design Review System
class GameDesignReview {
    constructor() {
        this.issues = [];
        this.currentIssue = null;
        this.teamMembers = [];
        this.settings = this.loadSettings();
        this.annotationCanvas = null;
        this.annotationContext = null;
        this.isDrawing = false;
        this.currentTool = 'draw';
        this.currentColor = '#ff0000';
        this.brushSize = 3;
        this.originalImage = null;
        
        this.init();
    }

    init() {
        this.loadIssues();
        this.loadTeamMembers();
        this.setupEventListeners();
        this.updateStatistics();
        this.populateFilters();
    }

    // Settings Management
    loadSettings() {
        const saved = localStorage.getItem('gameReviewSettings');
        return saved ? JSON.parse(saved) : {
            sheetsApiKey: '',
            spreadsheetId: '',
            teamMembers: []
        };
    }

    saveSettings() {
        localStorage.setItem('gameReviewSettings', JSON.stringify(this.settings));
    }

    // Issues Management
    loadIssues() {
        const saved = localStorage.getItem('gameReviewIssues');
        this.issues = saved ? JSON.parse(saved) : [];
        this.renderIssues();
    }

    saveIssues() {
        localStorage.setItem('gameReviewIssues', JSON.stringify(this.issues));
    }

    addIssue(issueData) {
        const issue = {
            id: Date.now().toString(),
            title: issueData.title,
            description: issueData.description,
            priority: issueData.priority,
            assignee: issueData.assignee,
            category: issueData.category,
            status: 'open',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            media: issueData.media || [],
            comments: [],
            annotations: []
        };

        this.issues.push(issue);
        this.saveIssues();
        this.renderIssues();
        this.updateStatistics();
        this.syncWithSheets();
    }

    updateIssue(issueId, updates) {
        const issue = this.issues.find(i => i.id === issueId);
        if (issue) {
            Object.assign(issue, updates, { updatedAt: new Date().toISOString() });
            this.saveIssues();
            this.renderIssues();
            this.updateStatistics();
            this.syncWithSheets();
        }
    }

    deleteIssue(issueId) {
        this.issues = this.issues.filter(i => i.id !== issueId);
        this.saveIssues();
        this.renderIssues();
        this.updateStatistics();
        this.syncWithSheets();
    }

    // Team Members Management
    loadTeamMembers() {
        const saved = localStorage.getItem('gameReviewTeamMembers');
        this.teamMembers = saved ? JSON.parse(saved) : [];
    }

    saveTeamMembers() {
        localStorage.setItem('gameReviewTeamMembers', JSON.stringify(this.teamMembers));
    }

    addTeamMember(name, email) {
        const member = { id: Date.now().toString(), name, email };
        this.teamMembers.push(member);
        this.saveTeamMembers();
        this.populateFilters();
    }

    removeTeamMember(memberId) {
        this.teamMembers = this.teamMembers.filter(m => m.id !== memberId);
        this.saveTeamMembers();
        this.populateFilters();
    }

    // UI Rendering
    renderIssues() {
        const issuesList = document.getElementById('issuesList');
        const filteredIssues = this.getFilteredIssues();

        issuesList.innerHTML = filteredIssues.length === 0 ? 
            '<div class="text-center p-2">No issues found</div>' : 
            filteredIssues.map(issue => this.renderIssueCard(issue)).join('');
    }

    renderIssueCard(issue) {
        const statusClass = `issue-status ${issue.status}`;
        const priorityClass = `issue-priority ${issue.priority}`;
        const assignee = this.teamMembers.find(m => m.id === issue.assignee);
        
        return `
            <div class="issue-card" data-issue-id="${issue.id}">
                <div class="issue-card-header">
                    <div>
                        <div class="issue-title">${this.escapeHtml(issue.title)}</div>
                        <div class="issue-meta">
                            <span class="${statusClass}">${issue.status}</span>
                            <span class="${priorityClass}">${issue.priority}</span>
                            <span class="issue-assignee">${assignee ? assignee.name : 'Unassigned'}</span>
                            <span class="issue-category">${issue.category}</span>
                        </div>
                    </div>
                    <div class="issue-actions">
                        <button class="btn btn-secondary btn-sm" onclick="gameReview.editIssue('${issue.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="gameReview.deleteIssue('${issue.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="issue-description">${this.escapeHtml(issue.description)}</div>
                ${issue.media.length > 0 ? `
                    <div class="issue-media-preview">
                        <i class="fas fa-image"></i> ${issue.media.length} attachment(s)
                    </div>
                ` : ''}
            </div>
        `;
    }

    getFilteredIssues() {
        const statusFilter = document.getElementById('statusFilter').value;
        const priorityFilter = document.getElementById('priorityFilter').value;
        const assigneeFilter = document.getElementById('assigneeFilter').value;
        const searchTerm = document.getElementById('searchIssues').value.toLowerCase();

        return this.issues.filter(issue => {
            const statusMatch = statusFilter === 'all' || issue.status === statusFilter;
            const priorityMatch = priorityFilter === 'all' || issue.priority === priorityFilter;
            const assigneeMatch = assigneeFilter === 'all' || issue.assignee === assigneeFilter;
            const searchMatch = !searchTerm || 
                issue.title.toLowerCase().includes(searchTerm) ||
                issue.description.toLowerCase().includes(searchTerm);

            return statusMatch && priorityMatch && assigneeMatch && searchMatch;
        });
    }

    updateStatistics() {
        document.getElementById('totalIssues').textContent = this.issues.length;
        document.getElementById('openIssues').textContent = this.issues.filter(i => i.status === 'open').length;
        document.getElementById('completedIssues').textContent = this.issues.filter(i => i.status === 'completed').length;
    }

    populateFilters() {
        const assigneeFilter = document.getElementById('assigneeFilter');
        const issueAssignee = document.getElementById('issueAssignee');
        
        const options = ['<option value="all">All Assignees</option>'];
        this.teamMembers.forEach(member => {
            options.push(`<option value="${member.id}">${this.escapeHtml(member.name)}</option>`);
        });

        assigneeFilter.innerHTML = options.join('');
        issueAssignee.innerHTML = '<option value="">Unassigned</option>' + options.slice(1).join('');
    }

    // Modal Management
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }

    // File Upload and Media Management
    setupFileUpload() {
        const fileUploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('fileInput');

        fileUploadArea.addEventListener('click', () => fileInput.click());
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.style.borderColor = '#3b82f6';
            fileUploadArea.style.background = '#f8fafc';
        });
        fileUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            fileUploadArea.style.borderColor = '#cbd5e1';
            fileUploadArea.style.background = '#ffffff';
        });
        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.style.borderColor = '#cbd5e1';
            fileUploadArea.style.background = '#ffffff';
            this.handleFileDrop(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });
    }

    handleFileDrop(files) {
        this.processFiles(Array.from(files));
    }

    handleFileSelect(files) {
        this.processFiles(Array.from(files));
    }

    processFiles(files) {
        const filePreview = document.getElementById('filePreview');
        const currentFiles = [];

        files.forEach(file => {
            if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const mediaItem = {
                        id: Date.now().toString() + Math.random(),
                        name: file.name,
                        type: file.type,
                        data: e.target.result,
                        size: file.size
                    };
                    currentFiles.push(mediaItem);
                    this.renderFilePreview(mediaItem);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    renderFilePreview(mediaItem) {
        const filePreview = document.getElementById('filePreview');
        const previewItem = document.createElement('div');
        previewItem.className = 'file-preview-item';
        previewItem.dataset.fileId = mediaItem.id;

        if (mediaItem.type.startsWith('image/')) {
            previewItem.innerHTML = `
                <img src="${mediaItem.data}" alt="${mediaItem.name}">
                <button class="remove-file" onclick="gameReview.removeFile('${mediaItem.id}')">&times;</button>
            `;
        } else {
            previewItem.innerHTML = `
                <video src="${mediaItem.data}" muted></video>
                <button class="remove-file" onclick="gameReview.removeFile('${mediaItem.id}')">&times;</button>
            `;
        }

        filePreview.appendChild(previewItem);
    }

    removeFile(fileId) {
        const previewItem = document.querySelector(`[data-file-id="${fileId}"]`);
        if (previewItem) {
            previewItem.remove();
        }
    }

    // Image Annotation System
    setupAnnotationCanvas() {
        this.annotationCanvas = document.getElementById('annotationCanvas');
        this.annotationContext = this.annotationCanvas.getContext('2d');
        
        this.annotationCanvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.annotationCanvas.addEventListener('mousemove', (e) => this.draw(e));
        this.annotationCanvas.addEventListener('mouseup', () => this.stopDrawing());
        this.annotationCanvas.addEventListener('mouseleave', () => this.stopDrawing());
    }

    loadImageForAnnotation(imageData) {
        this.originalImage = new Image();
        this.originalImage.onload = () => {
            this.annotationCanvas.width = this.originalImage.width;
            this.annotationCanvas.height = this.originalImage.height;
            this.annotationContext.drawImage(this.originalImage, 0, 0);
        };
        this.originalImage.src = imageData;
    }

    startDrawing(e) {
        this.isDrawing = true;
        const rect = this.annotationCanvas.getBoundingClientRect();
        this.annotationContext.beginPath();
        this.annotationContext.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }

    draw(e) {
        if (!this.isDrawing) return;
        
        const rect = this.annotationCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.annotationContext.strokeStyle = this.currentColor;
        this.annotationContext.lineWidth = this.brushSize;
        this.annotationContext.lineCap = 'round';
        this.annotationContext.lineTo(x, y);
        this.annotationContext.stroke();
    }

    stopDrawing() {
        this.isDrawing = false;
    }

    clearCanvas() {
        if (this.originalImage) {
            this.annotationContext.clearRect(0, 0, this.annotationCanvas.width, this.annotationCanvas.height);
            this.annotationContext.drawImage(this.originalImage, 0, 0);
        }
    }

    saveAnnotation() {
        const annotatedImageData = this.annotationCanvas.toDataURL('image/png');
        return annotatedImageData;
    }

    // Google Sheets Integration
    async syncWithSheets() {
        if (!this.settings.sheetsApiKey || !this.settings.spreadsheetId) {
            console.log('Google Sheets not configured');
            return;
        }

        try {
            await this.initializeGoogleSheetsAPI();
            await this.updateSpreadsheet();
        } catch (error) {
            console.error('Error syncing with Google Sheets:', error);
            this.showNotification('Error syncing with Google Sheets', 'error');
        }
    }

    async initializeGoogleSheetsAPI() {
        return new Promise((resolve, reject) => {
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: this.settings.sheetsApiKey,
                        discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
                    });
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    async updateSpreadsheet() {
        const headers = ['ID', 'Title', 'Description', 'Priority', 'Assignee', 'Category', 'Status', 'Created', 'Updated'];
        const values = this.issues.map(issue => [
            issue.id,
            issue.title,
            issue.description,
            issue.priority,
            this.teamMembers.find(m => m.id === issue.assignee)?.name || 'Unassigned',
            issue.category,
            issue.status,
            new Date(issue.createdAt).toLocaleDateString(),
            new Date(issue.updatedAt).toLocaleDateString()
        ]);

        const range = 'A1:I' + (values.length + 1);
        
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: this.settings.spreadsheetId,
            range: range,
            valueInputOption: 'RAW',
            resource: {
                values: [headers, ...values]
            }
        });
    }

    // Event Listeners
    setupEventListeners() {
        // Modal controls
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.hideModal(modal.id);
            });
        });

        // New issue button
        document.getElementById('newIssueBtn').addEventListener('click', () => {
            this.showModal('newIssueModal');
        });

        // New issue form
        document.getElementById('newIssueForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createNewIssue();
        });

        // Cancel buttons
        document.getElementById('cancelIssue').addEventListener('click', () => {
            this.hideModal('newIssueModal');
        });

        // Settings
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showModal('settingsModal');
            this.loadSettingsForm();
        });

        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettingsForm();
        });

        // Sync button
        document.getElementById('syncBtn').addEventListener('click', () => {
            this.syncWithSheets();
        });

        // Filters
        document.getElementById('statusFilter').addEventListener('change', () => this.renderIssues());
        document.getElementById('priorityFilter').addEventListener('change', () => this.renderIssues());
        document.getElementById('assigneeFilter').addEventListener('change', () => this.renderIssues());
        document.getElementById('searchIssues').addEventListener('input', () => this.renderIssues());

        // File upload
        this.setupFileUpload();

        // Annotation tools
        this.setupAnnotationTools();

        // Close modals when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });
    }

    setupAnnotationTools() {
        document.getElementById('drawTool').addEventListener('click', () => this.setTool('draw'));
        document.getElementById('arrowTool').addEventListener('click', () => this.setTool('arrow'));
        document.getElementById('textTool').addEventListener('click', () => this.setTool('text'));
        document.getElementById('circleTool').addEventListener('click', () => this.setTool('circle'));
        document.getElementById('rectTool').addEventListener('click', () => this.setTool('rect'));
        document.getElementById('clearCanvas').addEventListener('click', () => this.clearCanvas());
        
        document.getElementById('colorPicker').addEventListener('change', (e) => {
            this.currentColor = e.target.value;
        });
        
        document.getElementById('brushSize').addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
        });
    }

    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tool + 'Tool').classList.add('active');
    }

    // Form handling
    createNewIssue() {
        const formData = {
            title: document.getElementById('issueTitle').value,
            description: document.getElementById('issueDescription').value,
            priority: document.getElementById('issuePriority').value,
            assignee: document.getElementById('issueAssignee').value,
            category: document.getElementById('issueCategory').value,
            media: this.getCurrentFiles()
        };

        this.addIssue(formData);
        this.hideModal('newIssueModal');
        this.resetNewIssueForm();
        this.showNotification('Issue created successfully', 'success');
    }

    getCurrentFiles() {
        const files = [];
        document.querySelectorAll('#filePreview .file-preview-item').forEach(item => {
            const img = item.querySelector('img');
            const video = item.querySelector('video');
            if (img) {
                files.push({
                    type: 'image',
                    data: img.src,
                    name: 'Screenshot'
                });
            } else if (video) {
                files.push({
                    type: 'video',
                    data: video.src,
                    name: 'Video'
                });
            }
        });
        return files;
    }

    resetNewIssueForm() {
        document.getElementById('newIssueForm').reset();
        document.getElementById('filePreview').innerHTML = '';
    }

    loadSettingsForm() {
        document.getElementById('sheetsApiKey').value = this.settings.sheetsApiKey;
        document.getElementById('spreadsheetId').value = this.settings.spreadsheetId;
        this.renderTeamMembersList();
    }

    saveSettingsForm() {
        this.settings.sheetsApiKey = document.getElementById('sheetsApiKey').value;
        this.settings.spreadsheetId = document.getElementById('spreadsheetId').value;
        this.saveSettings();
        this.hideModal('settingsModal');
        this.showNotification('Settings saved successfully', 'success');
    }

    renderTeamMembersList() {
        const list = document.getElementById('teamMembersList');
        list.innerHTML = this.teamMembers.map(member => `
            <div class="team-member">
                <div class="team-member-info">
                    <div class="team-member-name">${this.escapeHtml(member.name)}</div>
                    <div class="team-member-email">${this.escapeHtml(member.email)}</div>
                </div>
                <button class="remove-member" onclick="gameReview.removeTeamMember('${member.id}')">Remove</button>
            </div>
        `).join('');
    }

    // Utility functions
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        // Simple notification system
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem;
            border-radius: 0.5rem;
            color: white;
            z-index: 10000;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    editIssue(issueId) {
        const issue = this.issues.find(i => i.id === issueId);
        if (issue) {
            this.currentIssue = issue;
            this.showIssueDetail(issue);
        }
    }

    showIssueDetail(issue) {
        document.getElementById('detailIssueTitle').textContent = issue.title;
        document.getElementById('detailIssueStatus').textContent = issue.status;
        document.getElementById('detailIssuePriority').textContent = issue.priority;
        document.getElementById('detailIssueAssignee').textContent = 
            this.teamMembers.find(m => m.id === issue.assignee)?.name || 'Unassigned';
        document.getElementById('detailIssueDescription').textContent = issue.description;
        
        this.renderIssueMedia(issue);
        this.renderIssueComments(issue);
        
        this.showModal('issueDetailModal');
    }

    renderIssueMedia(issue) {
        const container = document.getElementById('mediaContainer');
        container.innerHTML = issue.media.map(media => `
            <div class="media-item" onclick="gameReview.openAnnotation('${media.data}')">
                ${media.type === 'image' ? 
                    `<img src="${media.data}" alt="Screenshot">` :
                    `<video src="${media.data}" muted></video>`
                }
                <div class="media-item-overlay">
                    <i class="fas fa-edit"></i>
                </div>
            </div>
        `).join('');
    }

    renderIssueComments(issue) {
        const container = document.getElementById('commentsList');
        container.innerHTML = issue.comments.map(comment => `
            <div class="comment">
                <div class="comment-header">
                    <span class="comment-author">${this.escapeHtml(comment.author)}</span>
                    <span class="comment-date">${new Date(comment.date).toLocaleDateString()}</span>
                </div>
                <div class="comment-text">${this.escapeHtml(comment.text)}</div>
            </div>
        `).join('');
    }

    openAnnotation(imageData) {
        this.loadImageForAnnotation(imageData);
        this.setupAnnotationCanvas();
        this.showModal('annotationModal');
    }
}

// Initialize the application
let gameReview;
document.addEventListener('DOMContentLoaded', () => {
    gameReview = new GameDesignReview();
});
