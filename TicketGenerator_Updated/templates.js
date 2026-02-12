// Built-in templates
const BUILT_IN_TEMPLATES = [
    {
        id: 'blank-ticket',
        name: 'Blank Ticket',
        builtIn: true,
        backgroundImage: null,
        ticketSettings: {
            type: 'ticket',
            width: '226.32258',
            height: '80',
            fitMode: 'cover'
        },
        elements: [],
        labelBlock: null
    },
    {
        id: 'blank-convention-id',
        name: 'Blank Convention ID',
        builtIn: true,
        backgroundImage: null,
        ticketSettings: {
            type: 'convention-id',
            width: '101.6',
            height: '152.4',
            fitMode: 'cover'
        },
        elements: [],
        labelBlock: null
    },
    {
        id: 'blank-certificate',
        name: 'Blank Certificate',
        builtIn: true,
        backgroundImage: null,
        ticketSettings: {
            type: 'certificate',
            width: '297',
            height: '210',
            fitMode: 'cover'
        },
        elements: [],
        labelBlock: null
    }
];

function getTemplatesFromStorage() {
    try {
        const stored = localStorage.getItem('veenttix_templates');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('Error reading templates from localStorage:', e);
        return [];
    }
}

function saveTemplatesToStorage(templates) {
    try {
        localStorage.setItem('veenttix_templates', JSON.stringify(templates));
    } catch (e) {
        console.error('Error saving templates to localStorage:', e);
        if (e.name === 'QuotaExceededError') {
            showToast('error', 'Storage Full', 'Cannot save template. Try removing background images or deleting unused templates.');
        }
    }
}

function getAllTemplates() {
    return [...BUILT_IN_TEMPLATES, ...getTemplatesFromStorage()];
}

function saveUserTemplate(template) {
    const templates = getTemplatesFromStorage();
    template.id = 'user-' + Date.now();
    template.builtIn = false;
    templates.push(template);
    saveTemplatesToStorage(templates);
    return template;
}

function updateUserTemplate(templateId, updatedData) {
    const templates = getTemplatesFromStorage();
    const index = templates.findIndex(t => t.id === templateId);
    if (index === -1) return false;
    templates[index] = { ...templates[index], ...updatedData, id: templateId, builtIn: false };
    saveTemplatesToStorage(templates);
    return true;
}

function deleteUserTemplate(templateId) {
    const templates = getTemplatesFromStorage();
    const filtered = templates.filter(t => t.id !== templateId);
    saveTemplatesToStorage(filtered);
}

function getTemplateById(templateId) {
    return getAllTemplates().find(t => t.id === templateId);
}
