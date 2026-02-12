let csvData = [];
let csvHeaders = [];
let selectedElement = null;
let selectedElements = new Set();
let clipboardElements = [];
let suppressNextClick = false;
let backgroundImage = null;

// Canvas zoom
let canvasZoom = 1;


// Undo / Redo
let undoStack = [];
let redoStack = [];
let preActionState = null;
let actionHasMoved = false;
const MAX_UNDO_STATES = 50;
let isDragging = false;
let isResizing = false;
let dragOffset = { x: 0, y: 0 };

// Cached canvas dimensions (updated while design tab is visible)
let cachedCanvasRect = { width: 0, height: 0 };

// Background fit mode
let backgroundFitMode = 'cover';

// Label color block
let labelColumn = '';
let labelColors = {};
let labelBlockWidth = 50;
let labelBlockPosition = { left: 0, top: 0 };
let isDraggingLabelBlock = false;
let labelBlockDragOffset = { x: 0 };
let rightBlockEnabled = false;
let rightBlockWidth = 20;

// Custom QR logo
let customQRLogo = null;

// Toast notification system
function showToast(type, title, message, duration = 4000) {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Set icon based on type
    let icon;
    switch (type) {
        case 'success':
            icon = 'fas fa-check-circle';
            break;
        case 'error':
            icon = 'fas fa-exclamation-circle';
            break;
        case 'warning':
            icon = 'fas fa-exclamation-triangle';
            break;
        default:
            icon = 'fas fa-info-circle';
    }

    toast.innerHTML = `
        <div class="toast-icon">
            <i class="${icon}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="closeToast(this)">
            <i class="fas fa-times"></i>
        </button>
    `;

    toastContainer.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // Auto-dismiss after duration
    setTimeout(() => {
        closeToast(toast.querySelector('.toast-close'));
    }, duration);

    return toast;
}

function closeToast(button) {
    const toast = button.closest('.toast');
    toast.classList.remove('show');
    setTimeout(() => {
        toast.remove();
    }, 300);
}

function switchTab(tabName) {
    // Cache canvas dimensions while design tab is still visible
    const canvas = document.getElementById('ticket-canvas');
    if (canvas) {
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            cachedCanvasRect = { width: rect.width, height: rect.height };
        }
    }

    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-button');

    tabs.forEach(tab => tab.classList.remove('active'));
    buttons.forEach(btn => btn.classList.remove('active'));

    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');

    // Update PNG preview when switching to PNG export tab (only if stale)
    if (tabName === 'png-export' && pngPreviewDirty) {
        rebuildPNGPreview();
    }

    // Refresh label tabs when switching to preview tab
    if (tabName === 'preview') {
        refreshPreviewLabelTabs();
        document.getElementById('a4-preview').innerHTML = '<p>Click "Generate Preview" to render tickets</p>';
        updatePreviewStats(0, 0, 0);
    }
}

function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showToast('error', 'Invalid File Type', 'Please select a CSV file (.csv)');
        event.target.value = ''; // Reset file input
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('error', 'File Too Large', 'CSV file must be smaller than 5MB');
        event.target.value = ''; // Reset file input
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            parseCSV(text);
        } catch (error) {
            showToast('error', 'File Read Error', 'Failed to read the CSV file. Please try again.');
            console.error('CSV file read error:', error);
        }
    };

    reader.onerror = function() {
        showToast('error', 'File Read Error', 'Failed to read the CSV file. Please check the file and try again.');
    };

    reader.readAsText(file);
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
    }

    result.push(current.trim());
    return result;
}

function parseCSV(text) {
    try {
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length === 0) {
            showToast('error', 'Empty File', 'The CSV file appears to be empty');
            return;
        }

        if (lines.length < 2) {
            showToast('error', 'Invalid CSV', 'CSV file must contain at least a header row and one data row');
            return;
        }

        // Parse headers
        csvHeaders = parseCSVLine(lines[0]);

        if (csvHeaders.length === 0 || csvHeaders.every(header => !header)) {
            showToast('error', 'Invalid Headers', 'CSV file must contain valid column headers');
            return;
        }

        // Parse data rows
        csvData = lines.slice(1).map((line, index) => {
            const values = parseCSVLine(line);
            const row = {};
            csvHeaders.forEach((header, headerIndex) => {
                row[header] = values[headerIndex] || '';
            });
            return row;
        }).filter(row => {
            // Filter out completely empty rows
            return Object.values(row).some(value => value.trim());
        });

        if (csvData.length === 0) {
            showToast('error', 'No Data', 'CSV file contains headers but no valid data rows');
            return;
        }

        // Success! Update the UI
        displayHeaders();
        updateLabelColumnDropdown();
        updateQRColumnDropdown();
        updatePreview();
        updatePNGPreview();

        // Show success toast
        const rowCount = csvData.length;
        const headerCount = csvHeaders.length;
        showToast('success', 'CSV Upload Successful',
                  `Loaded ${rowCount} record${rowCount !== 1 ? 's' : ''} with ${headerCount} column${headerCount !== 1 ? 's' : ''}`);

    } catch (error) {
        showToast('error', 'CSV Parse Error', 'Failed to parse CSV file. Please check the file format and try again.');
        console.error('CSV parsing error:', error);
    }
}

function displayHeaders() {
    const headersContainer = document.getElementById('csv-headers');
    headersContainer.innerHTML = '';

    if (csvHeaders.length === 0) {
        headersContainer.innerHTML = '<p class="no-csv">Upload a CSV file to see headers</p>';
        return;
    }

    csvHeaders.forEach(header => {
        const headerElement = document.createElement('div');
        headerElement.className = 'header-item';
        headerElement.textContent = header;

        // Check if mobile device
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            // Mobile: Click to add
            headerElement.addEventListener('click', () => {
                addTextElementFromHeader(header);
            });
        } else {
            // Desktop: Drag to add
            headerElement.draggable = true;
            headerElement.addEventListener('dragstart', handleHeaderDragStart);
        }

        headersContainer.appendChild(headerElement);
    });
}

function addTextElementFromHeader(header) {
    saveUndoState();
    // Create text element with the header using proper parameters
    const textElement = createTextElement(header, 50, 30);

    // Add to canvas
    const container = document.getElementById('text-elements');
    container.appendChild(textElement);
    applyAutoFitToElement(textElement);

    // Update lists and previews
    updateElementsList();
    updatePreview();
    updatePNGPreview();

    // Show success toast
    showToast('success', 'Text Added', `Added "${header}" to your ticket design`);
}

function handleHeaderDragStart(event) {
    event.dataTransfer.setData('text/plain', event.target.textContent);
    event.target.classList.add('dragging');
}

function handleBackgroundUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        backgroundImage = e.target.result;
        const canvas = document.getElementById('canvas-background');
        canvas.style.backgroundImage = `url(${backgroundImage})`;
        applyBackgroundFitMode();
        updatePreview();
        updatePNGPreview();
    };
    reader.readAsDataURL(file);
}

function setupCanvasDropZone() {
    const canvas = document.getElementById('ticket-canvas');
    const dropZone = document.createElement('div');
    dropZone.className = 'drop-zone';
    dropZone.textContent = 'Drop header here';
    canvas.appendChild(dropZone);

    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('active');
    });

    canvas.addEventListener('dragleave', (e) => {
        if (!canvas.contains(e.relatedTarget)) {
            dropZone.classList.remove('active');
        }
    });

    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        saveUndoState();

        const headerText = e.dataTransfer.getData('text/plain');
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / canvasZoom;
        const y = (e.clientY - rect.top) / canvasZoom;

        const textElement = createTextElement(headerText, x, y);
        document.getElementById('text-elements').appendChild(textElement);
        applyAutoFitToElement(textElement);
        updateElementsList();

        document.querySelectorAll('.header-item').forEach(item => {
            item.classList.remove('dragging');
        });
    });
}

function createTextElement(text, x, y) {
    const textElement = document.createElement('div');
    textElement.className = 'text-element contain-box';
    textElement.textContent = `{${text}}`;
    textElement.dataset.textFormat = `{${text}}`;
    textElement.dataset.allowOverflow = 'false';
    textElement.dataset.containInBox = 'true';
    textElement.dataset.fontBold = 'false';
    textElement.dataset.disableNewLine = 'true';
    textElement.dataset.horizontalAlign = 'center';
    textElement.dataset.verticalAlign = 'center';
    textElement.dataset.rotation = '0';
    textElement.style.left = `${x}px`;
    textElement.style.top = `${y}px`;
    textElement.style.fontSize = '20px';
    textElement.style.color = '#000000';
    textElement.style.fontFamily = 'Arial';
    textElement.style.fontWeight = 'normal';
    textElement.style.textAlign = 'center';
    textElement.style.whiteSpace = 'nowrap';
    textElement.style.display = 'flex';
    textElement.style.alignItems = 'center';
    textElement.style.justifyContent = 'center';
    textElement.style.lineHeight = '1.2';

    const rotateHandle = document.createElement('div');
    rotateHandle.className = 'rotate-handle';
    textElement.appendChild(rotateHandle);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    textElement.appendChild(resizeHandle);

    // Add both mouse and touch event support
    textElement.addEventListener('mousedown', startDrag);
    textElement.addEventListener('touchstart', startDrag);
    resizeHandle.addEventListener('mousedown', startResize);
    resizeHandle.addEventListener('touchstart', startResize);
    rotateHandle.addEventListener('mousedown', startRotate);
    rotateHandle.addEventListener('touchstart', startRotate);
    textElement.addEventListener('click', selectElement);

    // Return the element instead of appending it directly
    return textElement;
}

function selectElement(event) {
    event.stopPropagation();

    // Suppress duplicate click after mousedown (startDrag already handled selection)
    if (event.type === 'click' && suppressNextClick) {
        suppressNextClick = false;
        return;
    }

    const el = event.target.closest('.text-element, .qr-element');
    if (!el) return;

    if (event.ctrlKey || event.metaKey) {
        // Ctrl+click: toggle this element's selection
        if (el.classList.contains('selected')) {
            el.classList.remove('selected');
            selectedElements.delete(el);
            if (selectedElement === el) {
                selectedElement = selectedElements.size > 0 ? [...selectedElements][selectedElements.size - 1] : null;
            }
            if (!selectedElement) {
                document.getElementById('text-properties').style.display = 'none';
            }
            return;
        } else {
            el.classList.add('selected');
            selectedElements.add(el);
            selectedElement = el;
        }
    } else {
        // Regular click: single select
        document.querySelectorAll('.text-element, .qr-element').forEach(e => e.classList.remove('selected'));
        selectedElements.clear();
        el.classList.add('selected');
        selectedElements.add(el);
        selectedElement = el;
    }

    // Show properties panel for the active element
    showElementProperties(selectedElement);
}

function showElementProperties(element) {
    if (!element) return;

    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        showMobileProperties(element);
    } else {
        document.getElementById('text-properties').style.display = 'block';
    }

    const isQR = element.classList.contains('qr-element');
    document.getElementById('text-controls').style.display = isQR ? 'none' : 'block';
    document.getElementById('qr-controls').style.display = isQR ? 'block' : 'none';

    if (isQR) {
        const qrSize = element.offsetWidth;
        document.getElementById('qr-size').value = qrSize;
        const codeType = element.dataset.codeType || 'qr';
        document.getElementById('code-type').value = codeType;

        document.getElementById('barcode-type-selection').style.display =
            codeType === 'barcode' ? 'block' : 'none';

        if (codeType === 'barcode') {
            document.getElementById('barcode-type').value = element.dataset.barcodeType || 'CODE128';
        }

        const canvas = element.querySelector('canvas');
        if (canvas && canvas.qr) {
            document.getElementById('qr-background').value = canvas.qr.background || '#ffffff';
            document.getElementById('qr-foreground').value = canvas.qr.foreground || '#000000';
        } else {
            document.getElementById('qr-background').value = '#ffffff';
            document.getElementById('qr-foreground').value = '#000000';
        }
    } else {
        const style = window.getComputedStyle(element);
        document.getElementById('font-size').value = parseInt(style.fontSize);
        document.getElementById('font-color').value = rgbToHex(style.color);
        document.getElementById('font-bold').checked = element.dataset.fontBold === 'true';
        document.getElementById('font-family').value = style.fontFamily.replace(/"/g, '');
        document.getElementById('horizontal-align').value = element.dataset.horizontalAlign || style.textAlign || 'center';
        document.getElementById('vertical-align').value = element.dataset.verticalAlign || 'center';
        document.getElementById('rotation-input').value = parseInt(element.dataset.rotation) || 0;
        document.getElementById('allow-overflow').checked = element.dataset.allowOverflow === 'true';
        document.getElementById('contain-in-box').checked = element.dataset.containInBox === 'true';
        document.getElementById('disable-new-line').checked = element.dataset.disableNewLine === 'true';
        document.getElementById('text-format').value = element.dataset.textFormat || element.textContent;
        document.getElementById('font-size-control').style.display =
            element.dataset.containInBox === 'true' ? 'none' : 'block';
    }
}

function rgbToHex(rgb) {
    if (rgb.startsWith('#')) return rgb;
    const values = rgb.match(/\d+/g);
    if (!values) return '#000000';
    const hex = values.map(val => parseInt(val).toString(16).padStart(2, '0')).join('');
    return `#${hex}`;
}

function updateSelectedText() {
    if (!selectedElement || selectedElement.classList.contains('qr-element')) return;
    saveUndoState();

    const fontColor = document.getElementById('font-color').value;
    const fontBold = document.getElementById('font-bold').checked;
    const fontFamily = document.getElementById('font-family').value;
    const horizontalAlign = document.getElementById('horizontal-align').value;
    const verticalAlign = document.getElementById('vertical-align').value;
    const allowOverflow = document.getElementById('allow-overflow').checked;
    const containInBox = document.getElementById('contain-in-box').checked;
    const disableNewLine = document.getElementById('disable-new-line').checked;
    const textFormat = document.getElementById('text-format').value;

    selectedElement.style.color = fontColor;
    selectedElement.style.fontFamily = fontFamily;
    selectedElement.style.fontWeight = fontBold ? 'bold' : 'normal';
    selectedElement.style.textAlign = horizontalAlign;
    selectedElement.dataset.fontBold = fontBold.toString();
    selectedElement.dataset.horizontalAlign = horizontalAlign;
    selectedElement.dataset.verticalAlign = verticalAlign;
    selectedElement.dataset.allowOverflow = allowOverflow.toString();
    selectedElement.dataset.containInBox = containInBox.toString();
    selectedElement.dataset.disableNewLine = disableNewLine.toString();

    // Apply flex alignment for vertical and horizontal centering
    selectedElement.style.display = 'flex';
    selectedElement.style.alignItems = verticalAlign === 'center' ? 'center' : verticalAlign === 'bottom' ? 'flex-end' : 'flex-start';
    selectedElement.style.justifyContent = horizontalAlign === 'center' ? 'center' : horizontalAlign === 'right' ? 'flex-end' : 'flex-start';
    selectedElement.style.lineHeight = '1.2';

    // Apply whiteSpace based on disableNewLine
    if (disableNewLine) {
        selectedElement.style.whiteSpace = 'nowrap';
    } else {
        selectedElement.style.whiteSpace = '';
    }

    // Toggle contain-box class for visual bounding box
    if (containInBox) {
        selectedElement.classList.add('contain-box');
    } else {
        selectedElement.classList.remove('contain-box');
    }

    // Show/hide font size control based on contain-in-box
    document.getElementById('font-size-control').style.display = containInBox ? 'none' : 'block';

    // Apply manual font size only when not auto-fitting
    if (!containInBox) {
        const fontSize = document.getElementById('font-size').value;
        selectedElement.style.fontSize = `${fontSize}px`;
    }

    // Update the text format and display
    if (textFormat) {
        selectedElement.dataset.textFormat = textFormat;
        selectedElement.textContent = textFormat;
    }

    // Re-add handles if they were lost during textContent update
    if (!selectedElement.querySelector('.rotate-handle')) {
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'rotate-handle';
        selectedElement.appendChild(rotateHandle);
        rotateHandle.addEventListener('mousedown', startRotate);
        rotateHandle.addEventListener('touchstart', startRotate);
    }
    if (!selectedElement.querySelector('.resize-handle')) {
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        selectedElement.appendChild(resizeHandle);
        resizeHandle.addEventListener('mousedown', startResize);
        resizeHandle.addEventListener('touchstart', startResize);
    }

    // Auto-fit if contain-in-box is on
    applyAutoFitToElement(selectedElement);

    updatePreview();
    updatePNGPreview();
}

function updateSelectedQR() {
    if (!selectedElement || !selectedElement.classList.contains('qr-element')) return;
    saveUndoState();

    const codeType = document.getElementById('code-type').value;
    const qrSize = document.getElementById('qr-size').value;
    const background = document.getElementById('qr-background').value;
    const foreground = document.getElementById('qr-foreground').value;
    const barcodeType = document.getElementById('barcode-type').value;

    // Show/hide barcode type selection
    document.getElementById('barcode-type-selection').style.display =
        codeType === 'barcode' ? 'block' : 'none';

    selectedElement.dataset.codeType = codeType;
    if (codeType === 'barcode') {
        selectedElement.dataset.barcodeType = barcodeType;
    }

    const canvas = selectedElement.querySelector('canvas');
    if (canvas) {
        regenerateCode(selectedElement, canvas);

        // Ensure logo is added back for QR codes
        if (codeType === 'qr') {
            const logoSrc = selectedElement.dataset.customLogo || undefined;
            setTimeout(() => addLogoToQR(canvas, parseInt(qrSize), logoSrc), 100);
        }
    }

    updatePreview();
    updatePNGPreview();
}

function addLogoToQR(canvas, qrSize, logoSrc) {
    if (!logoSrc) {
        logoSrc = 'https://www.veent.io/assets/images/veent-logo.svg';
    }
    const ctx = canvas.getContext('2d');

    // Smart logo sizing based on QR code size and readability
    let logoSizePercent;
    if (qrSize >= 200) {
        logoSizePercent = 0.20; // 20% for large QR codes
    } else if (qrSize >= 150) {
        logoSizePercent = 0.18; // 18% for medium QR codes
    } else if (qrSize >= 100) {
        logoSizePercent = 0.15; // 15% for standard QR codes
    } else if (qrSize >= 80) {
        logoSizePercent = 0.12; // 12% for small QR codes
    } else {
        logoSizePercent = 0.08; // 8% for very small QR codes
    }

    // Calculate logo size with minimum threshold
    const maxLogoSize = Math.max(qrSize * logoSizePercent, 16); // Minimum 16px for visibility

    // QR codes have built-in error correction (Level L: ~7%, M: ~15%, Q: ~25%, H: ~30%)
    // Most QR libraries use Level M (15% error correction), so we stay well below that
    // For very small QR codes, reduce logo size further to ensure scannability
    const finalLogoSize = qrSize < 60 ? Math.min(maxLogoSize, 12) : maxLogoSize;

    // Safety check: if logo becomes too small to be meaningful, skip it entirely
    if (finalLogoSize < 8) {
        return; // Don't add logo to extremely small QR codes
    }

    // Adaptive padding based on QR size
    const padding = qrSize < 80 ? 1 : 2;

    // Load and draw the Veent logo with preserved aspect ratio
    const logo = new Image();
    logo.onload = function() {
        // Get the actual aspect ratio of the logo
        const logoAspectRatio = logo.naturalWidth / logo.naturalHeight;

        // Calculate logo dimensions preserving aspect ratio
        let logoWidth, logoHeight;

        if (logoAspectRatio > 1) {
            // Logo is wider than tall - fit to final width
            logoWidth = finalLogoSize;
            logoHeight = finalLogoSize / logoAspectRatio;
        } else {
            // Logo is taller than wide - fit to final height
            logoHeight = finalLogoSize;
            logoWidth = finalLogoSize * logoAspectRatio;
        }

        // Center the logo
        const logoX = (qrSize - logoWidth) / 2;
        const logoY = (qrSize - logoHeight) / 2;

        // Background rectangle dimensions
        const bgWidth = logoWidth + (padding * 2);
        const bgHeight = logoHeight + (padding * 2);
        const bgX = logoX - padding;
        const bgY = logoY - padding;

        // Draw rounded rectangle background
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;

        // Create rounded rectangle path
        const radius = 4;
        ctx.beginPath();
        ctx.moveTo(bgX + radius, bgY);
        ctx.lineTo(bgX + bgWidth - radius, bgY);
        ctx.quadraticCurveTo(bgX + bgWidth, bgY, bgX + bgWidth, bgY + radius);
        ctx.lineTo(bgX + bgWidth, bgY + bgHeight - radius);
        ctx.quadraticCurveTo(bgX + bgWidth, bgY + bgHeight, bgX + bgWidth - radius, bgY + bgHeight);
        ctx.lineTo(bgX + radius, bgY + bgHeight);
        ctx.quadraticCurveTo(bgX, bgY + bgHeight, bgX, bgY + bgHeight - radius);
        ctx.lineTo(bgX, bgY + radius);
        ctx.quadraticCurveTo(bgX, bgY, bgX + radius, bgY);
        ctx.closePath();

        ctx.fill();
        ctx.stroke();

        // Draw the logo with preserved aspect ratio
        ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
        ctx.restore();
    };
    logo.crossOrigin = 'anonymous';
    logo.src = logoSrc;
}

function regenerateCode(element, canvas) {
    const codeType = element.dataset.codeType || 'qr';
    const placeholder = element.dataset.placeholder;
    const value = `{${placeholder}}`;
    const size = parseInt(document.getElementById('qr-size').value) || 100;
    const background = document.getElementById('qr-background').value;
    const foreground = document.getElementById('qr-foreground').value;
    const logoSrc = element.dataset.customLogo || undefined;

    if (codeType === 'qr') {
        // Generate QR Code
        element.style.width = `${size}px`;
        element.style.height = `${size}px`;

        if (typeof QRious !== 'undefined') {
            try {
                const qr = new QRious({
                    element: canvas,
                    value: value,
                    size: size,
                    background: background,
                    foreground: foreground
                });
                canvas.qr = qr;

                // Add logo to QR code
                setTimeout(() => addLogoToQR(canvas, size, logoSrc), 100);
            } catch (error) {
                showToast('error', 'QR Code Error', 'Failed to generate QR code');
                console.error('QR generation error:', error);
            }
        } else {
            showToast('error', 'Library Missing', 'QRious library not loaded. QR codes cannot be generated.');
        }
    } else {
        // Generate Barcode
        const barcodeType = element.dataset.barcodeType || 'CODE128';
        const barcodeWidth = Math.max(size * 2, 200);
        const barcodeHeight = Math.max(size * 0.6, 60);

        element.style.width = `${barcodeWidth}px`;
        element.style.height = `${barcodeHeight}px`;

        try {
            JsBarcode(canvas, value, {
                format: barcodeType,
                width: 2,
                height: barcodeHeight - 20,
                displayValue: true,
                background: background,
                lineColor: foreground,
                fontSize: 12
            });
        } catch (error) {
            // Fallback to CODE128 if the barcode type fails
            JsBarcode(canvas, value, {
                format: 'CODE128',
                width: 2,
                height: barcodeHeight - 20,
                displayValue: true,
                background: background,
                lineColor: foreground,
                fontSize: 12
            });
        }
    }
}

function deleteSelectedElement() {
    saveUndoState();
    if (selectedElements.size > 0) {
        selectedElements.forEach(el => el.remove());
        selectedElements.clear();
        selectedElement = null;
    } else if (selectedElement) {
        selectedElement.remove();
        selectedElement = null;
    } else {
        return;
    }
    document.getElementById('text-properties').style.display = 'none';
    updateElementsList();
    updatePreview();
    updatePNGPreview();
}

function deleteSelectedText() {
    deleteSelectedElement();
}

function startDrag(event) {
    if (event.target.classList.contains('resize-handle')) return;
    if (event.target.classList.contains('rotate-handle')) return;

    event.preventDefault(); // Prevent default touch behaviors

    isDragging = true;
    actionHasMoved = false;
    preActionState = document.getElementById('text-elements').innerHTML;
    suppressNextClick = true; // Prevent click handler from re-firing selection
    selectedElement = event.target.closest('.text-element, .qr-element');
    selectElement(event);

    const canvasRect = document.getElementById('ticket-canvas').getBoundingClientRect();

    // Handle both mouse and touch events
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    // Use CSS left/top position to compute offset, avoiding rotated bounding box issues
    const elLeft = parseFloat(selectedElement.style.left) || 0;
    const elTop = parseFloat(selectedElement.style.top) || 0;
    dragOffset.x = (clientX - canvasRect.left) / canvasZoom - elLeft;
    dragOffset.y = (clientY - canvasRect.top) / canvasZoom - elTop;

    // Add both mouse and touch event listeners
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', drag);
    document.addEventListener('touchend', stopDrag);

    event.preventDefault();
}

function drag(event) {
    if (!isDragging || !selectedElement) return;
    actionHasMoved = true;

    event.preventDefault(); // Prevent default touch behaviors

    const canvasRect = document.getElementById('ticket-canvas').getBoundingClientRect();

    // Handle both mouse and touch events
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    const x = (clientX - canvasRect.left) / canvasZoom - dragOffset.x;
    const y = (clientY - canvasRect.top) / canvasZoom - dragOffset.y;

    selectedElement.style.left = `${x}px`;
    selectedElement.style.top = `${y}px`;
}

function stopDrag() {
    if (actionHasMoved && preActionState !== null) {
        undoStack.push(preActionState);
        if (undoStack.length > MAX_UNDO_STATES) undoStack.shift();
        redoStack = [];
    }
    preActionState = null;
    actionHasMoved = false;
    isDragging = false;
    // Remove both mouse and touch event listeners
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('touchend', stopDrag);
    updatePreview();
}

function startResize(event) {
    event.stopPropagation();
    event.preventDefault(); // Prevent default touch behaviors

    isResizing = true;
    actionHasMoved = false;
    preActionState = document.getElementById('text-elements').innerHTML;
    selectedElement = event.target.parentElement;

    // Add both mouse and touch event listeners
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
    document.addEventListener('touchmove', resize);
    document.addEventListener('touchend', stopResize);
}

function resize(event) {
    if (!isResizing || !selectedElement) return;
    actionHasMoved = true;

    event.preventDefault(); // Prevent default touch behaviors

    const canvasRect = document.getElementById('ticket-canvas').getBoundingClientRect();
    const elementRect = selectedElement.getBoundingClientRect();

    // Handle both mouse and touch events
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    const width = Math.max(50, (clientX - elementRect.left) / canvasZoom);
    const height = Math.max(20, (clientY - elementRect.top) / canvasZoom);

    selectedElement.style.width = `${width}px`;
    selectedElement.style.height = `${height}px`;

    // Update QR code size if it's a QR element
    if (selectedElement.classList.contains('qr-element')) {
        const canvas = selectedElement.querySelector('canvas');
        if (canvas && canvas.qr) {
            const size = Math.min(width, height);
            canvas.qr.size = size;
            canvas.qr.update();
            document.getElementById('qr-size').value = size;

            // Re-add the logo after QR update
            const logoSrc = selectedElement.dataset.customLogo || undefined;
            setTimeout(() => addLogoToQR(canvas, size, logoSrc), 50);
        }
    }
}

function stopResize() {
    if (actionHasMoved && preActionState !== null) {
        undoStack.push(preActionState);
        if (undoStack.length > MAX_UNDO_STATES) undoStack.shift();
        redoStack = [];
    }
    preActionState = null;
    actionHasMoved = false;
    isResizing = false;
    // Remove both mouse and touch event listeners
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
    document.removeEventListener('touchmove', resize);
    document.removeEventListener('touchend', stopResize);
    // Re-calculate auto-fit font size after resize
    if (selectedElement && !selectedElement.classList.contains('qr-element')) {
        applyAutoFitToElement(selectedElement);
    }
    updatePreview();
}

// Rotation via drag handle
let isRotating = false;
let rotatingElement = null;

function startRotate(event) {
    event.stopPropagation();
    event.preventDefault();

    isRotating = true;
    actionHasMoved = false;
    preActionState = document.getElementById('text-elements').innerHTML;
    rotatingElement = event.target.closest('.text-element');
    selectedElement = rotatingElement;

    document.addEventListener('mousemove', rotateElement);
    document.addEventListener('mouseup', stopRotate);
    document.addEventListener('touchmove', rotateElement);
    document.addEventListener('touchend', stopRotate);
}

function rotateElement(event) {
    if (!isRotating || !rotatingElement) return;
    actionHasMoved = true;
    event.preventDefault();

    const rect = rotatingElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    // atan2 from center to mouse, offset by -90 so top = 0°
    let angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    // Snap to 45° increments when Shift is held
    if (event.shiftKey) {
        angle = Math.round(angle / 45) * 45;
    }

    angle = Math.round(angle) % 360;

    rotatingElement.dataset.rotation = angle.toString();
    rotatingElement.style.transform = angle !== 0 ? `rotate(${angle}deg)` : '';

    // Update sidebar display
    document.getElementById('rotation-input').value = angle;
}

function applyRotationFromInput() {
    if (!selectedElements.size) return;
    const element = selectedElements.values().next().value;
    if (!element) return;
    let angle = parseInt(document.getElementById('rotation-input').value) || 0;
    angle = ((angle % 360) + 360) % 360;
    document.getElementById('rotation-input').value = angle;
    saveUndoState();
    element.dataset.rotation = angle.toString();
    element.style.transform = angle !== 0 ? `rotate(${angle}deg)` : '';
    updatePreview();
    updatePNGPreview();
}

function positionTooltip(el) {
    const tip = el.querySelector('.info-tooltip-text');
    const sidebar = document.getElementById('sidebar');
    const sidebarRect = sidebar.getBoundingClientRect();
    const iconRect = el.getBoundingClientRect();
    const tipWidth = 220;
    // Clamp horizontally within sidebar
    let left = sidebarRect.left + (sidebarRect.width - tipWidth) / 2;
    tip.style.left = left + 'px';
    tip.style.top = (iconRect.top - 10) + 'px';
    tip.style.transform = 'translateY(-100%)';
}


function stopRotate() {
    if (actionHasMoved && preActionState !== null) {
        undoStack.push(preActionState);
        if (undoStack.length > MAX_UNDO_STATES) undoStack.shift();
        redoStack = [];
    }
    preActionState = null;
    actionHasMoved = false;
    isRotating = false;
    document.removeEventListener('mousemove', rotateElement);
    document.removeEventListener('mouseup', stopRotate);
    document.removeEventListener('touchmove', rotateElement);
    document.removeEventListener('touchend', stopRotate);
    updatePreview();
    updatePNGPreview();
}

function updateTicketType() {
    const ticketType = document.getElementById('ticket-type').value;
    const manualInputs = document.getElementById('manual-size-inputs');
    const widthInput = document.getElementById('ticket-width');
    const heightInput = document.getElementById('ticket-height');

    let width, height;

    switch (ticketType) {
        case 'ticket':
            width = 226.32258;
            height = 80;
            manualInputs.style.display = 'none';
            break;
        case 'convention-id':
            width = 101.6; // 4R portrait dimensions
            height = 152.4;
            manualInputs.style.display = 'none';
            break;
        case 'certificate':
            width = 297; // A4 landscape
            height = 210;
            manualInputs.style.display = 'none';
            break;
        case 'others':
        default:
            manualInputs.style.display = 'block';
            width = widthInput.value;
            height = heightInput.value;
            break;
    }

    if (ticketType !== 'others') {
        widthInput.value = width;
        heightInput.value = height;
    }

    updateTicketSize();
}

function updateTicketSize() {
    const width = document.getElementById('ticket-width').value;
    const height = document.getElementById('ticket-height').value;

    const canvas = document.getElementById('ticket-canvas');
    const scale = 4;
    canvas.style.width = `${width * scale}px`;
    canvas.style.height = `${height * scale}px`;

    // Refresh zoom margins for the new canvas size
    if (canvasZoom !== 1) setCanvasZoom(canvasZoom);

    updatePreview();
    updatePNGPreview();
}

function updateElementsList() {
    const elementsList = document.getElementById('elements-list');
    const allElements = document.querySelectorAll('.text-element, .qr-element');

    elementsList.innerHTML = '';

    if (allElements.length === 0) {
        elementsList.innerHTML = '<p class="no-elements">No elements added yet</p>';
        return;
    }

    allElements.forEach((element, index) => {
        const elementItem = document.createElement('div');
        elementItem.className = 'element-item';
        elementItem.dataset.elementIndex = index;

        const isQR = element.classList.contains('qr-element');
        const type = isQR ? 'QR Code' : 'Text';
        const content = isQR ? element.dataset.placeholder : (element.dataset.textFormat || element.textContent);

        elementItem.innerHTML = `
            <div class="element-type">${type}</div>
            <div class="element-content">${content}</div>
        `;

        elementItem.addEventListener('click', () => {
            selectElementFromList(element);
        });

        elementsList.appendChild(elementItem);
    });
}

function selectElementFromList(element) {
    document.querySelectorAll('.text-element, .qr-element').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.element-item').forEach(item => item.classList.remove('selected'));
    selectedElements.clear();

    element.classList.add('selected');
    selectedElements.add(element);
    selectedElement = element;

    // Find corresponding list item and select it
    const allElements = document.querySelectorAll('.text-element, .qr-element');
    const elementIndex = Array.from(allElements).indexOf(element);
    const listItem = document.querySelector(`[data-element-index="${elementIndex}"]`);
    if (listItem) {
        listItem.classList.add('selected');
    }

    showElementProperties(element);
}

function resetElementPosition() {
    if (!selectedElement) return;

    selectedElement.style.left = '10px';
    selectedElement.style.top = '10px';
    updatePreview();
}

function formatTextWithData(textFormat, data) {
    if (!textFormat) return '';

    // Replace all {columnName} placeholders with actual data
    return textFormat.replace(/\{([^}]+)\}/g, (match, columnName) => {
        return data[columnName] ?? columnName;
    });
}

// ==========================================
// Auto-Fit Text Size
// ==========================================

function computeVerticalY(boxY, boxH, contentHeight, lineCount, vAlign) {
    if (vAlign === 'center') {
        return boxY + (boxH - contentHeight) / 2;
    } else if (vAlign === 'bottom') {
        return boxY + boxH - contentHeight;
    }
    return boxY; // top
}

function getWrappedLines(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);

    return lines.length > 0 ? lines : [''];
}

function autoFitFontSize(text, maxWidth, maxHeight, fontFamily, isBold, noWrap) {
    if (!text || maxWidth <= 0 || maxHeight <= 0) return 8;

    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    const padding = 4;
    const availWidth = maxWidth - padding;
    const availHeight = maxHeight - padding;

    if (availWidth <= 0 || availHeight <= 0) return 8;

    let lo = 6, hi = Math.min(300, Math.floor(availHeight / 1.2));
    let bestSize = lo;

    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const weight = isBold ? 'bold' : 'normal';
        ctx.font = `${weight} ${mid}px ${fontFamily}`;

        if (noWrap) {
            // Single line: text must fit width AND height
            const metrics = ctx.measureText(text);
            const lineHeight = mid * 1.2;
            if (metrics.width <= availWidth && lineHeight <= availHeight) {
                bestSize = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        } else {
            const lines = getWrappedLines(ctx, text, availWidth);
            const lineHeight = mid * 1.2;
            const totalHeight = lines.length * lineHeight;

            if (totalHeight <= availHeight) {
                bestSize = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
    }

    return Math.max(6, bestSize);
}

function applyAutoFitToElement(element) {
    if (!element || element.classList.contains('qr-element')) return;
    if (element.dataset.containInBox !== 'true') return;

    const text = element.dataset.textFormat || element.textContent;
    const width = parseFloat(element.style.width) || element.offsetWidth;
    const height = parseFloat(element.style.height) || element.offsetHeight;

    if (width <= 0 || height <= 0) return;

    // Persist measured dimensions so preview can reliably read them
    // even when the design tab is off-screen (offsetWidth would be 0)
    if (!element.style.width) element.style.width = `${width}px`;
    if (!element.style.height) element.style.height = `${height}px`;

    const fontFamily = element.style.fontFamily || 'Arial';
    const isBold = element.dataset.fontBold === 'true';
    const noWrap = element.dataset.disableNewLine === 'true';

    const fontSize = autoFitFontSize(text, width, height, fontFamily, isBold, noWrap);
    element.style.fontSize = `${fontSize}px`;
}

// ==========================================
// Background Fit Mode
// ==========================================

function getBackgroundSizeCSS(fitMode) {
    switch (fitMode) {
        case 'contain': return { backgroundSize: 'contain', backgroundPosition: 'center' };
        case 'stretch': return { backgroundSize: '100% 100%', backgroundPosition: 'center' };
        case 'original': return { backgroundSize: 'auto', backgroundPosition: 'center' };
        case 'cover':
        default: return { backgroundSize: 'cover', backgroundPosition: 'center' };
    }
}

function updateBackgroundFitMode() {
    backgroundFitMode = document.getElementById('bg-fit-mode').value;
    applyBackgroundFitMode();
    updatePreview();
    updatePNGPreview();
}

function applyBackgroundFitMode() {
    const canvas = document.getElementById('canvas-background');
    const fitCSS = getBackgroundSizeCSS(backgroundFitMode);
    canvas.style.backgroundSize = fitCSS.backgroundSize;
    canvas.style.backgroundPosition = fitCSS.backgroundPosition;
}

function drawBackgroundOnCanvas(ctx, img, canvasWidth, canvasHeight, fitMode) {
    switch (fitMode) {
        case 'contain': {
            const scale = Math.min(canvasWidth / img.naturalWidth, canvasHeight / img.naturalHeight);
            const w = img.naturalWidth * scale;
            const h = img.naturalHeight * scale;
            const x = (canvasWidth - w) / 2;
            const y = (canvasHeight - h) / 2;
            ctx.drawImage(img, x, y, w, h);
            break;
        }
        case 'stretch':
            ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
            break;
        case 'original': {
            const x = (canvasWidth - img.naturalWidth) / 2;
            const y = (canvasHeight - img.naturalHeight) / 2;
            ctx.drawImage(img, x, y);
            break;
        }
        case 'cover':
        default: {
            const scale = Math.max(canvasWidth / img.naturalWidth, canvasHeight / img.naturalHeight);
            const w = img.naturalWidth * scale;
            const h = img.naturalHeight * scale;
            const x = (canvasWidth - w) / 2;
            const y = (canvasHeight - h) / 2;
            ctx.drawImage(img, x, y, w, h);
            break;
        }
    }
}

// ==========================================
// Label Color Block
// ==========================================

function updateLabelColumnDropdown() {
    const select = document.getElementById('label-column');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">None</option>';

    csvHeaders.forEach(header => {
        const option = document.createElement('option');
        option.value = header;
        option.textContent = header;
        select.appendChild(option);
    });

    if (currentValue && csvHeaders.includes(currentValue)) {
        select.value = currentValue;
    }
}

function updateLabelColumn() {
    labelColumn = document.getElementById('label-column').value;
    const colorAssignments = document.getElementById('label-color-assignments');
    const labelBlockControls = document.getElementById('label-block-controls');

    if (!labelColumn) {
        colorAssignments.innerHTML = '';
        labelBlockControls.style.display = 'none';
        removeLabelBlockFromCanvas();
        activePreviewLabel = '__all__';
        updatePreview();
        updatePNGPreview();
        return;
    }

    labelBlockControls.style.display = 'block';

    const uniqueValues = [...new Set(csvData.map(row => row[labelColumn]).filter(v => v))];

    const defaultColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'];
    uniqueValues.forEach((value, index) => {
        if (!labelColors[value]) {
            labelColors[value] = defaultColors[index % defaultColors.length];
        }
    });

    // Clean up colors for values that no longer exist
    Object.keys(labelColors).forEach(key => {
        if (!uniqueValues.includes(key)) {
            delete labelColors[key];
        }
    });

    colorAssignments.innerHTML = '';
    uniqueValues.forEach(value => {
        const row = document.createElement('div');
        row.className = 'label-color-row';
        row.innerHTML = `
            <span class="label-color-value" title="${value}">${value}</span>
            <input type="color" value="${labelColors[value]}" onchange="assignLabelColor('${value.replace(/'/g, "\\'")}', this.value)">
        `;
        colorAssignments.appendChild(row);
    });

    addLabelBlockToCanvas();
    updatePreview();
    updatePNGPreview();
}

function assignLabelColor(value, color) {
    labelColors[value] = color;
    addLabelBlockToCanvas();
    updatePreview();
    updatePNGPreview();
}

function updateLabelBlockWidth() {
    labelBlockWidth = parseInt(document.getElementById('label-block-width').value) || 10;
    document.getElementById('label-block-width-value').textContent = labelBlockWidth + 'px';
    addLabelBlockToCanvas();
    updatePreview();
    updatePNGPreview();
}

function updateRightLabelBlock() {
    const checkbox = document.getElementById('label-right-block-enabled');
    const controls = document.getElementById('right-block-controls');
    rightBlockEnabled = checkbox.checked;
    controls.style.display = rightBlockEnabled ? 'block' : 'none';
    if (rightBlockEnabled) {
        rightBlockWidth = parseInt(document.getElementById('label-right-block-width').value) || 20;
    }
    addLabelBlockToCanvas();
    updatePreview();
    updatePNGPreview();
}

function getFirstLabelColor() {
    if (!labelColumn || csvData.length === 0) return '#cccccc';
    const firstValue = csvData[0][labelColumn];
    return labelColors[firstValue] || '#cccccc';
}

function addLabelBlockToCanvas() {
    removeLabelBlockFromCanvas();
    if (!labelColumn) return;

    const canvas = document.getElementById('ticket-canvas');
    const block = document.createElement('div');
    block.className = 'label-block';
    block.id = 'label-block';
    block.style.left = `${labelBlockPosition.left}px`;
    block.style.width = `${labelBlockWidth}px`;
    block.style.backgroundColor = getFirstLabelColor();

    // Show first label value as vertical text
    const firstValue = csvData.length > 0 ? csvData[0][labelColumn] : '';
    if (firstValue) {
        const labelText = document.createElement('span');
        labelText.className = 'label-block-text';
        labelText.textContent = firstValue;
        block.appendChild(labelText);
    }

    block.addEventListener('mousedown', startLabelBlockDrag);
    block.addEventListener('touchstart', startLabelBlockDrag);

    canvas.appendChild(block);

    // Add right-side color block
    if (rightBlockEnabled) {
        const rightBlock = document.createElement('div');
        rightBlock.className = 'label-block';
        rightBlock.id = 'label-right-block';
        rightBlock.style.right = '0px';
        rightBlock.style.left = 'auto';
        rightBlock.style.width = `${rightBlockWidth}px`;
        rightBlock.style.backgroundColor = getFirstLabelColor();
        rightBlock.style.cursor = 'default';
        canvas.appendChild(rightBlock);
    }
}

function removeLabelBlockFromCanvas() {
    const existing = document.getElementById('label-block');
    if (existing) existing.remove();
    const existingRight = document.getElementById('label-right-block');
    if (existingRight) existingRight.remove();
}

function startLabelBlockDrag(event) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingLabelBlock = true;

    const block = document.getElementById('label-block');
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    labelBlockDragOffset.x = (clientX - block.getBoundingClientRect().left) / canvasZoom;

    document.addEventListener('mousemove', dragLabelBlock);
    document.addEventListener('mouseup', stopLabelBlockDrag);
    document.addEventListener('touchmove', dragLabelBlock);
    document.addEventListener('touchend', stopLabelBlockDrag);
}

function dragLabelBlock(event) {
    if (!isDraggingLabelBlock) return;
    event.preventDefault();

    const canvas = document.getElementById('ticket-canvas');
    const canvasRect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;

    const x = (clientX - canvasRect.left) / canvasZoom - labelBlockDragOffset.x;
    const block = document.getElementById('label-block');
    if (block) {
        const maxX = canvasRect.width / canvasZoom - block.offsetWidth;
        block.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
    }
}

function stopLabelBlockDrag() {
    isDraggingLabelBlock = false;
    const block = document.getElementById('label-block');
    if (block) {
        labelBlockPosition.left = parseFloat(block.style.left) || 0;
    }
    document.removeEventListener('mousemove', dragLabelBlock);
    document.removeEventListener('mouseup', stopLabelBlockDrag);
    document.removeEventListener('touchmove', dragLabelBlock);
    document.removeEventListener('touchend', stopLabelBlockDrag);
    updatePreview();
    updatePNGPreview();
}

function getLabelBlockRenderData(rowData) {
    if (!labelColumn || !rowData[labelColumn]) return null;
    const value = rowData[labelColumn];
    const color = labelColors[value] || '#cccccc';
    return {
        color, value, width: labelBlockWidth, left: labelBlockPosition.left,
        rightEnabled: rightBlockEnabled, rightWidth: rightBlockWidth
    };
}

// ==========================================
// QR / Barcode Section
// ==========================================

function updateQRColumnDropdown() {
    const select = document.getElementById('qr-column');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">-- Select Column --</option>';

    csvHeaders.forEach(header => {
        const option = document.createElement('option');
        option.value = header;
        option.textContent = header;
        select.appendChild(option);
    });

    if (currentValue && csvHeaders.includes(currentValue)) {
        select.value = currentValue;
    }
}

function addQRCodeFromSection() {
    const column = document.getElementById('qr-column').value;
    if (!column) {
        showToast('warning', 'No Column Selected', 'Please select a data column for the QR code');
        return;
    }
    saveUndoState();

    const container = document.getElementById('text-elements');

    const qrElement = document.createElement('div');
    qrElement.className = 'qr-element';
    qrElement.style.left = '50px';
    qrElement.style.top = '50px';
    qrElement.style.width = '100px';
    qrElement.style.height = '100px';
    qrElement.dataset.placeholder = column;
    qrElement.dataset.codeType = 'qr';
    qrElement.dataset.codeSize = '100';
    qrElement.dataset.codeBackground = '#ffffff';
    qrElement.dataset.codeForeground = '#000000';

    const canvas = document.createElement('canvas');
    qrElement.appendChild(canvas);

    // Generate QR code with placeholder text
    const value = `{${column}}`;
    if (typeof QRious !== 'undefined') {
        try {
            const qr = new QRious({
                element: canvas,
                value: value,
                size: 100,
                background: '#ffffff',
                foreground: '#000000'
            });
            canvas.qr = qr;
            setTimeout(() => addLogoToQR(canvas, 100), 100);
        } catch (error) {
            showToast('error', 'QR Code Error', 'Failed to generate QR code');
            console.error('QR generation error:', error);
            return;
        }
    } else {
        showToast('error', 'Library Missing', 'QRious library not loaded. QR codes cannot be generated.');
        return;
    }

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    qrElement.appendChild(resizeHandle);

    qrElement.addEventListener('mousedown', startDrag);
    qrElement.addEventListener('touchstart', startDrag);
    resizeHandle.addEventListener('mousedown', startResize);
    resizeHandle.addEventListener('touchstart', startResize);
    qrElement.addEventListener('click', selectElement);

    container.appendChild(qrElement);

    updateElementsList();
    updatePreview();
    updatePNGPreview();

    showToast('success', 'QR Code Added', `Added QR code for "${column}" to your ticket design`);
}

function trimImageBackground(dataUrl) {
    return new Promise(function(resolve) {
        const img = new Image();
        img.onload = function() {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, c.width, c.height);
            const data = imageData.data;
            const w = c.width;
            const h = c.height;

            // Find the bounding box of non-background pixels
            // A pixel is "background" if it's white/near-white or fully transparent
            let top = h, left = w, bottom = 0, right = 0;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const i = (y * w + x) * 4;
                    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                    // Skip fully transparent pixels
                    if (a < 10) continue;
                    // Skip near-white pixels (r,g,b all > 240)
                    if (r > 240 && g > 240 && b > 240) continue;
                    // This pixel has content
                    if (y < top) top = y;
                    if (y > bottom) bottom = y;
                    if (x < left) left = x;
                    if (x > right) right = x;
                }
            }

            // If no content found, return original
            if (top > bottom || left > right) {
                resolve(dataUrl);
                return;
            }

            // Add a small padding (2px)
            const pad = 2;
            top = Math.max(0, top - pad);
            left = Math.max(0, left - pad);
            bottom = Math.min(h - 1, bottom + pad);
            right = Math.min(w - 1, right + pad);

            const cropW = right - left + 1;
            const cropH = bottom - top + 1;

            const trimmed = document.createElement('canvas');
            trimmed.width = cropW;
            trimmed.height = cropH;
            const tCtx = trimmed.getContext('2d');
            tCtx.drawImage(c, left, top, cropW, cropH, 0, 0, cropW, cropH);

            resolve(trimmed.toDataURL('image/png'));
        };
        img.src = dataUrl;
    });
}

function handleQRLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
        showToast('error', 'Invalid File', 'Please upload a JPG, PNG, or SVG image');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const rawDataUrl = e.target.result;
        trimImageBackground(rawDataUrl).then(function(trimmedUrl) {
            customQRLogo = trimmedUrl;
            document.getElementById('qr-logo-status').textContent = `Logo: ${file.name}`;
            document.getElementById('qr-logo-status').style.color = '#28a745';
            document.getElementById('add-qr-custom-logo-btn').disabled = false;
            const previewContainer = document.getElementById('qr-logo-preview');
            const previewImg = document.getElementById('qr-logo-preview-img');
            previewImg.src = trimmedUrl;
            previewContainer.style.display = 'block';
            showToast('success', 'Logo Uploaded', 'Custom logo ready. Click "Add QR with Custom Logo" to use it.');
        });
    };
    reader.readAsDataURL(file);
}

function addQRCodeWithCustomLogo() {
    const column = document.getElementById('qr-column').value;
    if (!column) {
        showToast('warning', 'No Column Selected', 'Please select a data column for the QR code');
        return;
    }
    if (!customQRLogo) {
        showToast('warning', 'No Logo', 'Please upload a logo image first');
        return;
    }
    saveUndoState();

    const container = document.getElementById('text-elements');

    const qrElement = document.createElement('div');
    qrElement.className = 'qr-element';
    qrElement.style.left = '50px';
    qrElement.style.top = '50px';
    qrElement.style.width = '100px';
    qrElement.style.height = '100px';
    qrElement.dataset.placeholder = column;
    qrElement.dataset.codeType = 'qr';
    qrElement.dataset.codeSize = '100';
    qrElement.dataset.codeBackground = '#ffffff';
    qrElement.dataset.codeForeground = '#000000';
    qrElement.dataset.customLogo = customQRLogo;

    const canvas = document.createElement('canvas');
    qrElement.appendChild(canvas);

    const value = `{${column}}`;
    if (typeof QRious !== 'undefined') {
        try {
            const qr = new QRious({
                element: canvas,
                value: value,
                size: 100,
                background: '#ffffff',
                foreground: '#000000'
            });
            canvas.qr = qr;
            setTimeout(() => addLogoToQR(canvas, 100, customQRLogo), 100);
        } catch (error) {
            showToast('error', 'QR Code Error', 'Failed to generate QR code');
            console.error('QR generation error:', error);
            return;
        }
    } else {
        showToast('error', 'Library Missing', 'QRious library not loaded. QR codes cannot be generated.');
        return;
    }

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    qrElement.appendChild(resizeHandle);

    qrElement.addEventListener('mousedown', startDrag);
    qrElement.addEventListener('touchstart', startDrag);
    resizeHandle.addEventListener('mousedown', startResize);
    resizeHandle.addEventListener('touchstart', startResize);
    qrElement.addEventListener('click', selectElement);

    container.appendChild(qrElement);

    updateElementsList();
    updatePreview();
    updatePNGPreview();

    showToast('success', 'QR Code Added', `Added QR code with custom logo for "${column}"`);
}

// ==========================================
// Templates
// ==========================================

function populateTemplateDropdown() {
    const select = document.getElementById('template-select');
    if (!select) return;

    select.innerHTML = '<option value="">-- Select Template --</option>';

    const templates = getAllTemplates();
    templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.name + (template.builtIn ? ' (Built-in)' : '');
        select.appendChild(option);
    });
}

function loadSelectedTemplate() {
    const select = document.getElementById('template-select');
    const templateId = select.value;
    if (!templateId) {
        showToast('warning', 'No Template', 'Please select a template to load');
        return;
    }

    const template = getTemplateById(templateId);
    if (!template) {
        showToast('error', 'Template Not Found', 'The selected template could not be found');
        return;
    }

    // Save current CSV data (templates don't affect CSV data)
    const savedCsvData = csvData;
    const savedCsvHeaders = csvHeaders;

    // Clear current design elements
    document.getElementById('text-elements').innerHTML = '';
    selectedElement = null;
    selectedElements.clear();
    document.getElementById('text-properties').style.display = 'none';

    // Restore background
    if (template.backgroundImage) {
        backgroundImage = template.backgroundImage;
        document.getElementById('canvas-background').style.backgroundImage = `url(${backgroundImage})`;
    } else {
        backgroundImage = null;
        document.getElementById('canvas-background').style.backgroundImage = '';
    }

    // Restore ticket settings
    if (template.ticketSettings) {
        if (template.ticketSettings.type) {
            document.getElementById('ticket-type').value = template.ticketSettings.type;
        }
        if (template.ticketSettings.width) {
            document.getElementById('ticket-width').value = template.ticketSettings.width;
        }
        if (template.ticketSettings.height) {
            document.getElementById('ticket-height').value = template.ticketSettings.height;
        }
        if (template.ticketSettings.fitMode) {
            backgroundFitMode = template.ticketSettings.fitMode;
            document.getElementById('bg-fit-mode').value = backgroundFitMode;
        }
        updateTicketType();
    }

    applyBackgroundFitMode();

    // Restore elements
    if (template.elements) {
        template.elements.forEach(elementData => {
            restoreElement(elementData);
        });
    }

    // Restore label block settings (position and width only, not column/colors)
    if (template.labelBlock) {
        labelBlockWidth = template.labelBlock.width || 10;
        labelBlockPosition = template.labelBlock.position || { left: 0, top: 0 };
        document.getElementById('label-block-width').value = labelBlockWidth;
        document.getElementById('label-block-width-value').textContent = labelBlockWidth + 'px';
    }

    // Restore CSV data
    csvData = savedCsvData;
    csvHeaders = savedCsvHeaders;

    updateElementsList();
    updatePreview();
    updatePNGPreview();
    if (labelColumn) addLabelBlockToCanvas();

    showToast('success', 'Template Loaded', `Loaded template: ${template.name}`);
}

function buildTemplateData(name) {
    return {
        name: name,
        backgroundImage: backgroundImage,
        ticketSettings: {
            type: document.getElementById('ticket-type').value,
            width: document.getElementById('ticket-width').value,
            height: document.getElementById('ticket-height').value,
            fitMode: backgroundFitMode
        },
        elements: [],
        labelBlock: labelColumn ? {
            width: labelBlockWidth,
            position: { ...labelBlockPosition }
        } : null
    };

    const allElements = document.querySelectorAll('.text-element, .qr-element');
    allElements.forEach(element => {
        const elementData = {
            type: element.classList.contains('qr-element') ? 'qr' : 'text',
            position: {
                left: element.style.left,
                top: element.style.top,
                width: (parseFloat(element.style.width) || element.offsetWidth) + 'px',
                height: (parseFloat(element.style.height) || element.offsetHeight) + 'px'
            },
            content: element.classList.contains('qr-element') ?
                element.dataset.placeholder :
                (element.dataset.textFormat || element.textContent),
            styles: {
                fontSize: element.style.fontSize,
                color: element.style.color,
                fontFamily: element.style.fontFamily,
                fontBold: element.dataset.fontBold === 'true',
                textAlign: element.style.textAlign || 'center',
                horizontalAlign: element.dataset.horizontalAlign || 'center',
                verticalAlign: element.dataset.verticalAlign || 'center',
                rotation: parseInt(element.dataset.rotation) || 0
            },
            allowOverflow: element.dataset.allowOverflow === 'true',
            containInBox: element.dataset.containInBox === 'true',
            disableNewLine: element.dataset.disableNewLine === 'true'
        };

        if (element.classList.contains('qr-element')) {
            const actualSize = Math.min(parseFloat(element.style.width) || element.offsetWidth, parseFloat(element.style.height) || element.offsetHeight);
            elementData.codeSettings = {
                codeType: element.dataset.codeType || 'qr',
                size: actualSize.toString(),
                background: element.dataset.codeBackground || '#ffffff',
                foreground: element.dataset.codeForeground || '#000000'
            };
            if (element.dataset.codeType === 'barcode') {
                elementData.codeSettings.barcodeType = element.dataset.barcodeType || 'CODE128';
            }
            if (element.dataset.customLogo) {
                elementData.codeSettings.customLogo = element.dataset.customLogo;
            }
        }

        template.elements.push(elementData);
    });

    return template;
}

function saveAsTemplate() {
    const select = document.getElementById('template-select');
    const selectedId = select.value;
    const selectedTemplate = selectedId ? getTemplateById(selectedId) : null;

    // If a user template is selected, offer to overwrite it
    if (selectedTemplate && !selectedTemplate.builtIn) {
        const overwrite = confirm(`Overwrite template "${selectedTemplate.name}"?\n\nClick OK to overwrite, or Cancel to save as a new template.`);
        if (overwrite) {
            const template = buildTemplateData(selectedTemplate.name);
            updateUserTemplate(selectedId, template);
            populateTemplateDropdown();
            // Re-select the same template
            document.getElementById('template-select').value = selectedId;
            showToast('success', 'Template Updated', `Template "${selectedTemplate.name}" updated successfully`);
            return;
        }
    }

    // Save as new template
    const nameInput = prompt('Enter a name for this template:', selectedTemplate ? selectedTemplate.name + ' (copy)' : '');
    if (!nameInput || !nameInput.trim()) return;

    const name = nameInput.trim();
    const template = buildTemplateData(name);
    const saved = saveUserTemplate(template);
    populateTemplateDropdown();
    // Select the newly saved template
    document.getElementById('template-select').value = saved.id;
    showToast('success', 'Template Saved', `Template "${name}" saved successfully`);
}

function deleteSelectedTemplate() {
    const select = document.getElementById('template-select');
    const templateId = select.value;
    if (!templateId) {
        showToast('warning', 'No Template', 'Please select a template to delete');
        return;
    }

    const template = getTemplateById(templateId);
    if (!template) {
        showToast('error', 'Template Not Found', 'The selected template could not be found');
        return;
    }

    if (template.builtIn) {
        showToast('warning', 'Cannot Delete', 'Built-in templates cannot be deleted');
        return;
    }

    if (!confirm(`Are you sure you want to delete template "${template.name}"?`)) return;

    deleteUserTemplate(templateId);
    populateTemplateDropdown();

    showToast('success', 'Template Deleted', `Template "${template.name}" deleted`);
}

function addCutLines(pageDiv, ticketsPerRow, ticketsPerCol, ticketWidth, ticketHeight, gap, orientation) {
    const cutLinesContainer = document.createElement('div');
    cutLinesContainer.className = 'cut-lines-container';
    cutLinesContainer.style.position = 'absolute';
    cutLinesContainer.style.top = '0mm';  // Start from paper edge
    cutLinesContainer.style.left = '0mm'; // Start from paper edge
    cutLinesContainer.style.width = orientation === 'landscape' ? '297mm' : '210mm';  // Full paper width
    cutLinesContainer.style.height = orientation === 'landscape' ? '210mm' : '297mm'; // Full paper height
    cutLinesContainer.style.pointerEvents = 'none';
    cutLinesContainer.style.zIndex = '5'; // Above page background, below tickets (which are z-index 10)

    const availableWidth = orientation === 'landscape' ? 277 : 190;  // Printable area
    const availableHeight = orientation === 'landscape' ? 190 : 277; // Printable area
    const paperWidth = orientation === 'landscape' ? 297 : 210;      // Full paper dimensions
    const paperHeight = orientation === 'landscape' ? 210 : 297;     // Full paper dimensions

    // Calculate total grid width and height
    const totalGapWidth = gap > 0 ? (ticketsPerRow - 1) * gap : 0;
    const totalGapHeight = gap > 0 ? (ticketsPerCol - 1) * gap : 0;
    const gridWidth = (ticketsPerRow * ticketWidth) + totalGapWidth;
    const gridHeight = (ticketsPerCol * ticketHeight) + totalGapHeight;

    // Calculate starting position to center the grid (accounting for 10mm margins)
    const startX = 10 + (availableWidth - gridWidth) / 2;  // 10mm margin + centering
    const startY = 10 + (availableHeight - gridHeight) / 2; // 10mm margin + centering

    // Vertical cut lines (between columns and at edges)
    for (let col = 0; col <= ticketsPerRow; col++) {
        const x = startX + (col * ticketWidth) + (col * gap);

        // Create vertical cut line that goes from top to bottom of paper
        const vLine = document.createElement('div');
        vLine.style.position = 'absolute';
        vLine.style.left = `${x}mm`;
        vLine.style.top = '0mm';
        vLine.style.width = '0.2mm';
        vLine.style.height = `${paperHeight}mm`;  // Full paper height
        vLine.style.backgroundColor = '#000';
        vLine.style.opacity = '0.3';
        cutLinesContainer.appendChild(vLine);
    }

    // Horizontal cut lines (between rows and at edges)
    for (let row = 0; row <= ticketsPerCol; row++) {
        const y = startY + (row * ticketHeight) + (row * gap);

        // Create horizontal cut line that goes from left to right of paper
        const hLine = document.createElement('div');
        hLine.style.position = 'absolute';
        hLine.style.left = '0mm';
        hLine.style.top = `${y}mm`;
        hLine.style.width = `${paperWidth}mm`;  // Full paper width
        hLine.style.height = '0.2mm';
        hLine.style.backgroundColor = '#000';
        hLine.style.opacity = '0.3';
        cutLinesContainer.appendChild(hLine);
    }

    pageDiv.appendChild(cutLinesContainer);
}

let previewDirty = true;
let activePreviewLabel = '__all__';

// updatePreview is called from many places — it only marks dirty and refreshes label tabs
function updatePreview() {
    previewDirty = true;
    const previewTab = document.getElementById('preview-tab');
    if (previewTab.classList.contains('active')) {
        refreshPreviewLabelTabs();
    }
}

function refreshPreviewLabelTabs() {
    const tabsContainer = document.getElementById('preview-label-tabs');
    tabsContainer.innerHTML = '';

    // Reset activePreviewLabel if it references a label that no longer exists
    if (activePreviewLabel !== '__all__' && activePreviewLabel !== '__none__') {
        if (!labelColumn) {
            activePreviewLabel = '__all__';
        } else {
            const uniqueValues = [...new Set(csvData.map(row => row[labelColumn]).filter(v => v))];
            if (!uniqueValues.includes(activePreviewLabel)) {
                activePreviewLabel = '__all__';
            }
        }
    } else if (activePreviewLabel === '__none__' && !labelColumn) {
        activePreviewLabel = '__all__';
    }

    // "All" tab
    const allBtn = document.createElement('button');
    allBtn.className = 'preview-label-tab' + (activePreviewLabel === '__all__' ? ' active' : '');
    allBtn.dataset.label = '__all__';
    allBtn.textContent = 'All (' + csvData.length + ')';
    allBtn.onclick = function() { switchPreviewLabel(this, '__all__'); };
    tabsContainer.appendChild(allBtn);

    // Label color tabs (only if a label column is set)
    if (labelColumn && csvData.length > 0) {
        const uniqueValues = [...new Set(csvData.map(row => row[labelColumn]).filter(v => v))];
        uniqueValues.forEach(value => {
            const count = csvData.filter(row => row[labelColumn] === value).length;
            const color = labelColors[value] || '#cccccc';
            const btn = document.createElement('button');
            btn.className = 'preview-label-tab' + (activePreviewLabel === value ? ' active' : '');
            btn.dataset.label = value;
            btn.textContent = value + ' (' + count + ')';
            btn.style.borderColor = color;
            if (activePreviewLabel === value) {
                btn.style.background = color;
                btn.style.color = '#fff';
                btn.style.borderColor = color;
            }
            btn.onclick = function() { switchPreviewLabel(this, value); };
            tabsContainer.appendChild(btn);
        });

        // "No Label" tab for rows without a value in the label column
        const noLabelCount = csvData.filter(row => !row[labelColumn]).length;
        if (noLabelCount > 0) {
            const btn = document.createElement('button');
            btn.className = 'preview-label-tab' + (activePreviewLabel === '__none__' ? ' active' : '');
            btn.dataset.label = '__none__';
            btn.textContent = 'No Label (' + noLabelCount + ')';
            btn.onclick = function() { switchPreviewLabel(this, '__none__'); };
            tabsContainer.appendChild(btn);
        }
    }
}

function switchPreviewLabel(btn, label) {
    activePreviewLabel = label;
    document.querySelectorAll('.preview-label-tab').forEach(b => {
        b.classList.remove('active');
        // Reset inline styles for color tabs
        if (b.dataset.label !== '__all__' && b.dataset.label !== '__none__') {
            b.style.background = '';
            b.style.color = '';
        }
    });
    btn.classList.add('active');
    // Re-apply color styling for active color tab
    if (label !== '__all__' && label !== '__none__' && labelColors[label]) {
        btn.style.background = labelColors[label];
        btn.style.color = '#fff';
        btn.style.borderColor = labelColors[label];
    }
    // Clear preview so user clicks Generate
    document.getElementById('a4-preview').innerHTML = '<p>Click "Generate Preview" to render tickets for this group</p>';
    updatePreviewStats(0, 0, 0);
}

function getFilteredCsvData() {
    if (activePreviewLabel === '__all__') return csvData;
    if (activePreviewLabel === '__none__') return csvData.filter(row => !row[labelColumn]);
    return csvData.filter(row => row[labelColumn] === activePreviewLabel);
}

function showLoading(text, indeterminate) {
    const overlay = document.getElementById('loading-overlay');
    if (text) overlay.querySelector('.loading-text').textContent = text;
    const counter = document.getElementById('loading-counter');
    const barFill = document.getElementById('loading-bar-fill');
    counter.textContent = '';
    if (indeterminate) {
        barFill.style.width = '';
        barFill.classList.add('indeterminate');
    } else {
        barFill.classList.remove('indeterminate');
        barFill.style.width = '0%';
    }
    overlay.style.display = 'flex';
}

function updateLoadingProgress(current, total, label) {
    const counter = document.getElementById('loading-counter');
    const barFill = document.getElementById('loading-bar-fill');
    const percent = Math.round((current / total) * 100);
    counter.textContent = label ? `${label} ${current}/${total}` : `${current} / ${total}`;
    barFill.classList.remove('indeterminate');
    barFill.style.width = `${percent}%`;
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

function generatePreviewForLabel() {
    if (csvData.length === 0) {
        document.getElementById('a4-preview').innerHTML = '<p>Upload a CSV file first</p>';
        updatePreviewStats(0, 0, 0);
        return;
    }

    const filteredData = getFilteredCsvData();
    if (filteredData.length === 0) {
        document.getElementById('a4-preview').innerHTML = '<p>No tickets in this group</p>';
        updatePreviewStats(0, 0, 0);
        return;
    }

    showLoading('Generating preview...');
    updateLoadingProgress(0, filteredData.length, 'Ticket');
    setTimeout(() => { _doGeneratePreview(filteredData); }, 50);
}

function _doGeneratePreview(filteredData) {
    // Temporarily show the design tab off-screen so we can measure elements
    const designTab = document.getElementById('design-tab');
    const wasHidden = !designTab.classList.contains('active');
    if (wasHidden) {
        designTab.style.position = 'absolute';
        designTab.style.left = '-9999px';
        designTab.style.display = 'flex';
    }

    // Update cached canvas rect from the now-measurable canvas
    const canvasEl = document.getElementById('ticket-canvas');
    if (canvasEl) {
        const rect = canvasEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            cachedCanvasRect = { width: rect.width, height: rect.height };
        }
    }

    const ticketType = document.getElementById('ticket-type').value;
    let ticketsPerRow, ticketsPerCol, orientation;

    switch (ticketType) {
        case 'ticket':
            ticketsPerRow = 2;
            ticketsPerCol = 4;
            orientation = 'landscape';
            break;
        case 'convention-id':
            ticketsPerRow = 2;
            ticketsPerCol = 2;
            orientation = 'portrait';
            break;
        case 'certificate':
            ticketsPerRow = 1;
            ticketsPerCol = 1;
            orientation = 'landscape';
            break;
        case 'others':
        default:
            ticketsPerRow = 2;
            ticketsPerCol = 3;
            orientation = 'portrait';
            break;
    }

    const ticketWidth = parseFloat(document.getElementById('ticket-width').value) || 85;
    const ticketHeight = parseFloat(document.getElementById('ticket-height').value) || 54;
    const ticketGap = parseFloat(document.getElementById('ticket-gap').value) || 2;

    const preview = document.getElementById('a4-preview');
    preview.innerHTML = '';

    let availableWidth = 190;
    let availableHeight = 277;

    if (orientation === 'landscape') {
        availableWidth = 277;
        availableHeight = 190;
    }

    let actualTicketWidth, actualTicketHeight;

    const totalGapWidth = ticketGap > 0 ? (ticketsPerRow - 1) * ticketGap : 0;
    const totalGapHeight = ticketGap > 0 ? (ticketsPerCol - 1) * ticketGap : 0;

    if (ticketType === 'certificate') {
        actualTicketWidth = availableWidth;
        actualTicketHeight = availableHeight;
    } else if (ticketType === 'convention-id') {
        actualTicketWidth = (availableWidth - totalGapWidth) / ticketsPerRow;
        actualTicketHeight = (availableHeight - totalGapHeight) / ticketsPerCol;
    } else {
        actualTicketWidth = Math.min(ticketWidth, (availableWidth - totalGapWidth) / ticketsPerRow);
        actualTicketHeight = Math.min(ticketHeight, (availableHeight - totalGapHeight) / ticketsPerCol);
    }

    const ticketsPerPage = ticketsPerRow * ticketsPerCol;
    const totalPages = Math.ceil(filteredData.length / ticketsPerPage);
    const totalTickets = filteredData.length;

    updatePreviewStats(totalTickets, totalPages, ticketsPerPage);

    // Build pages and tickets in batches so the UI can update the progress bar
    const BATCH_SIZE = 8;
    let ticketIndex = 0;
    let currentPage = 0;
    let pageDiv = null;
    let ticketOnPage = 0;

    function createPageDiv(pageNum) {
        const div = document.createElement('div');
        div.className = 'preview-page';
        div.style.gridTemplateColumns = `repeat(${ticketsPerRow}, ${actualTicketWidth}mm)`;
        div.style.gridTemplateRows = `repeat(${ticketsPerCol}, ${actualTicketHeight}mm)`;
        div.style.gridAutoFlow = 'row';

        if (ticketGap > 0) {
            div.style.gap = `${ticketGap}mm`;
            div.style.rowGap = `${ticketGap}mm`;
            div.style.columnGap = `${ticketGap}mm`;
        } else {
            div.style.gap = '0';
            div.style.rowGap = '0';
            div.style.columnGap = '0';
        }
        div.style.justifyContent = 'center';
        div.style.alignContent = 'start';

        if (orientation === 'landscape') {
            div.style.width = '297mm';
            div.style.height = '210mm';
        } else {
            div.style.width = '210mm';
            div.style.height = '297mm';
        }

        const pageNumber = document.createElement('div');
        pageNumber.className = 'page-number';
        pageNumber.textContent = `Page ${pageNum + 1} of ${totalPages}`;
        div.appendChild(pageNumber);
        return div;
    }

    function processBatch() {
        const batchEnd = Math.min(ticketIndex + BATCH_SIZE, totalTickets);

        for (; ticketIndex < batchEnd; ticketIndex++) {
            // Start a new page if needed
            if (!pageDiv) {
                pageDiv = createPageDiv(currentPage);
                ticketOnPage = 0;
            }

            const rowData = filteredData[ticketIndex];
            const ticket = createPreviewTicket(rowData, actualTicketWidth, actualTicketHeight);
            pageDiv.appendChild(ticket);
            ticketOnPage++;

            // If this page is full, finalize it
            if (ticketOnPage >= ticketsPerPage) {
                addCutLines(pageDiv, ticketsPerRow, ticketsPerCol, actualTicketWidth, actualTicketHeight, ticketGap, orientation);
                preview.appendChild(pageDiv);
                pageDiv = null;
                currentPage++;
            }
        }

        updateLoadingProgress(ticketIndex, totalTickets, 'Ticket');

        if (ticketIndex < totalTickets) {
            // More tickets to process — yield to let the UI repaint
            setTimeout(processBatch, 0);
        } else {
            // Finalize last partial page
            if (pageDiv) {
                addCutLines(pageDiv, ticketsPerRow, ticketsPerCol, actualTicketWidth, actualTicketHeight, ticketGap, orientation);
                preview.appendChild(pageDiv);
            }

            // Re-hide design tab if we temporarily showed it
            if (wasHidden) {
                designTab.style.position = '';
                designTab.style.left = '';
                designTab.style.display = '';
            }

            previewDirty = false;
            hideLoading();
        }
    }

    processBatch();
}

function updatePreviewStats(totalTickets, totalPages, ticketsPerPage) {
    document.getElementById('total-tickets').textContent = totalTickets;
    document.getElementById('total-pages').textContent = totalPages;
    document.getElementById('tickets-per-page').textContent = ticketsPerPage;
}

function createPreviewTicket(data, width, height) {
    const ticket = document.createElement('div');
    ticket.className = 'preview-ticket';
    ticket.style.width = `${width}mm`;
    ticket.style.height = `${height}mm`;

    if (backgroundImage) {
        const bg = document.createElement('div');
        bg.className = 'ticket-bg';
        bg.style.backgroundImage = `url(${backgroundImage})`;
        const fitCSS = getBackgroundSizeCSS(backgroundFitMode);
        bg.style.backgroundSize = fitCSS.backgroundSize;
        bg.style.backgroundPosition = fitCSS.backgroundPosition;
        bg.style.backgroundRepeat = 'no-repeat';
        ticket.appendChild(bg);
    }

    // Add label color block
    const labelData = getLabelBlockRenderData(data);
    if (labelData) {
        const labelCanvasWidth = cachedCanvasRect.width || 1;
        const leftPercent = (labelData.left / labelCanvasWidth) * 100;
        const widthPercent = (labelData.width / labelCanvasWidth) * 100;

        const labelDiv = document.createElement('div');
        labelDiv.style.position = 'absolute';
        labelDiv.style.left = `${leftPercent}%`;
        labelDiv.style.top = '0';
        labelDiv.style.width = `${widthPercent}%`;
        labelDiv.style.height = '100%';
        labelDiv.style.backgroundColor = labelData.color;
        labelDiv.style.zIndex = '5';
        labelDiv.style.webkitPrintColorAdjust = 'exact';
        labelDiv.style.colorAdjust = 'exact';
        labelDiv.style.printColorAdjust = 'exact';
        labelDiv.style.display = 'flex';
        labelDiv.style.alignItems = 'center';
        labelDiv.style.justifyContent = 'center';
        labelDiv.style.overflow = 'hidden';

        // Add vertical label text
        const labelText = document.createElement('span');
        labelText.textContent = labelData.value;
        labelText.style.writingMode = 'vertical-lr';
        labelText.style.transform = 'rotate(180deg)';
        labelText.style.textOrientation = 'mixed';
        labelText.style.color = '#ffffff';
        labelText.style.fontFamily = 'Arial, sans-serif';
        labelText.style.fontWeight = 'bold';
        labelText.style.textAlign = 'center';
        labelText.style.whiteSpace = 'nowrap';
        labelText.style.overflow = 'hidden';
        labelText.style.maxHeight = '100%';
        labelText.style.lineHeight = '1';
        // Auto-size: use the block width (in mm) as a rough font size cap
        const blockWidthMm = (widthPercent / 100) * width;
        const labelFontSize = Math.max(6, Math.min(blockWidthMm * 2.5, 14));
        labelText.style.fontSize = `${labelFontSize}px`;
        labelDiv.appendChild(labelText);

        ticket.appendChild(labelDiv);

        // Add right-side color block (no text)
        if (labelData.rightEnabled) {
            const rightWidthPercent = (labelData.rightWidth / labelCanvasWidth) * 100;
            const rightDiv = document.createElement('div');
            rightDiv.style.position = 'absolute';
            rightDiv.style.right = '0';
            rightDiv.style.top = '0';
            rightDiv.style.width = `${rightWidthPercent}%`;
            rightDiv.style.height = '100%';
            rightDiv.style.backgroundColor = labelData.color;
            rightDiv.style.zIndex = '5';
            rightDiv.style.webkitPrintColorAdjust = 'exact';
            rightDiv.style.colorAdjust = 'exact';
            rightDiv.style.printColorAdjust = 'exact';
            ticket.appendChild(rightDiv);
        }
    }

    const allElements = document.querySelectorAll('.text-element, .qr-element');
    const canvasWidth = cachedCanvasRect.width || 1;
    const canvasHeight = cachedCanvasRect.height || 1;

    allElements.forEach(element => {
        const leftPx = parseFloat(element.style.left) || 0;
        const topPx = parseFloat(element.style.top) || 0;
        const widthPx = parseFloat(element.style.width) || element.offsetWidth || element.getBoundingClientRect().width || 100;
        const heightPx = parseFloat(element.style.height) || element.offsetHeight || element.getBoundingClientRect().height || 30;

        const leftPercent = (leftPx / canvasWidth) * 100;
        const topPercent = (topPx / canvasHeight) * 100;
        const widthPercent = (widthPx / canvasWidth) * 100;
        const heightPercent = (heightPx / canvasHeight) * 100;

        if (element.classList.contains('qr-element')) {
            const qrDiv = document.createElement('div');
            qrDiv.style.position = 'absolute';
            qrDiv.style.left = `${leftPercent}%`;
            qrDiv.style.top = `${topPercent}%`;
            qrDiv.style.width = `${widthPercent}%`;
            qrDiv.style.height = `${heightPercent}%`;

            const placeholder = element.dataset.placeholder;
            const textFormat = `{${placeholder}}`;
            const codeValue = formatTextWithData(textFormat, data);
            const codeType = element.dataset.codeType || 'qr';

            const canvas = document.createElement('canvas');

            if (codeType === 'qr') {
                const qrSize = Math.min(widthPx, heightPx);
                const qr = new QRious({
                    element: canvas,
                    value: codeValue,
                    size: qrSize,
                    background: element.dataset.codeBackground || '#ffffff',
                    foreground: element.dataset.codeForeground || '#000000'
                });

                // Add logo to QR code
                const previewLogoSrc = element.dataset.customLogo || undefined;
                setTimeout(() => addLogoToQR(canvas, qrSize, previewLogoSrc), 100);
            } else {
                const barcodeType = element.dataset.barcodeType || 'CODE128';
                const background = element.dataset.codeBackground || '#ffffff';
                const foreground = element.dataset.codeForeground || '#000000';
                try {
                    JsBarcode(canvas, codeValue, {
                        format: barcodeType,
                        width: 2,
                        height: heightPx - 20,
                        displayValue: true,
                        background: background,
                        lineColor: foreground,
                        fontSize: 12
                    });
                } catch (error) {
                    JsBarcode(canvas, codeValue, {
                        format: 'CODE128',
                        width: 2,
                        height: heightPx - 20,
                        displayValue: true,
                        background: background,
                        lineColor: foreground,
                        fontSize: 12
                    });
                }
            }

            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.objectFit = 'contain';
            qrDiv.appendChild(canvas);
            ticket.appendChild(qrDiv);
        } else {
            const text = document.createElement('div');
            text.className = 'ticket-text';

            const textFormat = element.dataset.textFormat || element.textContent;
            text.textContent = formatTextWithData(textFormat, data);

            text.style.left = `${leftPercent}%`;
            text.style.top = `${topPercent}%`;
            text.style.width = `${widthPercent}%`;
            text.style.height = `${heightPercent}%`;
            text.style.color = element.style.color;
            text.style.fontFamily = element.style.fontFamily;
            text.style.fontWeight = element.dataset.fontBold === 'true' ? 'bold' : 'normal';
            text.style.textAlign = element.style.textAlign || 'left';

            // Auto-fit or manual font size
            const containInBox = element.dataset.containInBox === 'true';
            const isBold = element.dataset.fontBold === 'true';
            const noWrap = element.dataset.disableNewLine === 'true';
            if (containInBox) {
                const textWidthPx = (widthPercent / 100) * width * 3.78;
                const textHeightPx = (heightPercent / 100) * height * 3.78;
                const autoSize = autoFitFontSize(text.textContent, textWidthPx, textHeightPx, element.style.fontFamily || 'Arial', isBold, noWrap);
                text.style.fontSize = `${autoSize}px`;
            } else {
                text.style.fontSize = element.style.fontSize;
            }

            // Better text alignment and positioning
            const hAlign = element.dataset.horizontalAlign || element.style.textAlign || 'center';
            const vAlign = element.dataset.verticalAlign || 'center';
            text.style.display = 'flex';
            text.style.alignItems = vAlign === 'center' ? 'center' : vAlign === 'bottom' ? 'flex-end' : 'flex-start';
            text.style.justifyContent = hAlign === 'center' ? 'center' : hAlign === 'right' ? 'flex-end' : 'flex-start';
            text.style.textAlign = hAlign;
            text.style.boxSizing = 'border-box';
            text.style.padding = '2px';
            text.style.lineHeight = '1.2';

            // Apply rotation
            const rotation = parseInt(element.dataset.rotation) || 0;
            if (rotation !== 0) {
                text.style.transform = `rotate(${rotation}deg)`;
            }

            // Apply whiteSpace for disableNewLine
            if (noWrap) {
                text.style.whiteSpace = 'nowrap';
            }

            // Handle overflow setting - containInBox overrides allowOverflow
            const allowOverflow = element.dataset.allowOverflow === 'true';
            if (containInBox || !allowOverflow) {
                text.style.overflow = 'hidden';
                if (!noWrap) {
                    text.style.wordWrap = 'break-word';
                    text.style.wordBreak = 'break-word';
                    text.style.hyphens = 'auto';
                }
            } else {
                text.style.overflow = 'visible';
                text.style.whiteSpace = 'nowrap';
            }

            ticket.appendChild(text);
        }
    });

    return ticket;
}

function generatePrint() {
    if (csvData.length === 0) {
        alert('Please upload a CSV file first');
        return;
    }

    // Check if preview has been generated
    const previewCheck = document.getElementById('a4-preview');
    const hasPreview = previewCheck.querySelectorAll('.preview-page').length > 0;
    if (!hasPreview) {
        showToast('warning', 'No Preview', 'Please click "Generate Preview" first before printing.');
        return;
    }

    // Show margin reminder modal before printing
    const overlay = document.getElementById('print-reminder-overlay');
    overlay.style.display = 'flex';

    const okBtn = document.getElementById('print-reminder-ok');
    const cancelBtn = document.getElementById('print-reminder-cancel');

    function cleanup() {
        overlay.style.display = 'none';
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
    }

    function onOk() {
        cleanup();
        const ticketCount = previewCheck.querySelectorAll('.preview-ticket').length;
        showLoading('Preparing print...');
        updateLoadingProgress(0, ticketCount, 'Processing');
        setTimeout(() => { _doGeneratePrint(); }, 50);
    }

    function onCancel() {
        cleanup();
    }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
}

function _doGeneratePrint() {
    const previewEl = document.getElementById('a4-preview');
    const ticketCount = previewEl.querySelectorAll('.preview-ticket').length;
    console.log('Print: found', previewEl.querySelectorAll('.preview-page').length, 'pages,', ticketCount, 'tickets');

    // Get orientation based on ticket type
    const ticketType = document.getElementById('ticket-type').value;
    let orientation;

    switch (ticketType) {
        case 'ticket':
        case 'certificate':
            orientation = 'landscape';
            break;
        case 'convention-id':
        case 'others':
        default:
            orientation = 'portrait';
            break;
    }

    // Convert canvas elements to images in batches so the progress bar updates
    const canvases = Array.from(previewEl.querySelectorAll('canvas'));
    const canvasReplacements = [];
    const totalSteps = canvases.length + 2; // canvases + HTML build + open window
    let canvasIndex = 0;
    const BATCH_SIZE = 4;

    function convertCanvas(canvas) {
        try {
            const img = document.createElement('img');
            img.src = canvas.toDataURL('image/png');
            img.style.cssText = canvas.style.cssText;
            img.width = canvas.width;
            img.height = canvas.height;
            img.setAttribute('data-canvas-placeholder', 'true');
            const parent = canvas.parentNode;
            parent.replaceChild(img, canvas);
            canvasReplacements.push({ canvas, img, parent });
        } catch (e) {
            try {
                const cleanCanvas = document.createElement('canvas');
                cleanCanvas.width = canvas.width;
                cleanCanvas.height = canvas.height;
                if (typeof QRious !== 'undefined' && canvas.qr) {
                    new QRious({
                        element: cleanCanvas,
                        value: canvas.qr.value,
                        size: Math.min(canvas.width, canvas.height),
                        background: canvas.qr.background || '#ffffff',
                        foreground: canvas.qr.foreground || '#000000'
                    });
                }
                const img = document.createElement('img');
                img.src = cleanCanvas.toDataURL('image/png');
                img.style.cssText = canvas.style.cssText;
                img.width = canvas.width;
                img.height = canvas.height;
                img.setAttribute('data-canvas-placeholder', 'true');
                const parent = canvas.parentNode;
                parent.replaceChild(img, canvas);
                canvasReplacements.push({ canvas, img, parent });
            } catch (e2) {
                console.warn('Could not convert canvas to image:', e, e2);
            }
        }
    }

    function processCanvasBatch() {
        const batchEnd = Math.min(canvasIndex + BATCH_SIZE, canvases.length);
        for (; canvasIndex < batchEnd; canvasIndex++) {
            convertCanvas(canvases[canvasIndex]);
        }
        updateLoadingProgress(canvasIndex, totalSteps, 'Processing');

        if (canvasIndex < canvases.length) {
            setTimeout(processCanvasBatch, 0);
        } else {
            setTimeout(finalizePrint, 0);
        }
    }

    function finalizePrint() {
        updateLoadingProgress(canvases.length + 1, totalSteps, 'Processing');

        // Strip duplicate background-image inline styles for optimization
        const ticketBgDivs = Array.from(previewEl.querySelectorAll('.ticket-bg'));
        if (backgroundImage) {
            ticketBgDivs.forEach(bg => { bg.style.backgroundImage = ''; });
        }

        const previewHTML = previewEl.innerHTML;
        console.log('Print HTML length:', previewHTML.length);

        // Restore background-image inline styles for the live preview
        if (backgroundImage) {
            ticketBgDivs.forEach(bg => { bg.style.backgroundImage = `url(${backgroundImage})`; });
        }

        // Restore original canvas elements
        canvasReplacements.forEach(({ canvas, img, parent }) => {
            if (img.parentNode === parent) {
                parent.replaceChild(canvas, img);
            }
        });

        updateLoadingProgress(totalSteps, totalSteps, 'Processing');

        // Build orientation-specific dimensions
        const pageWidth = orientation === 'landscape' ? '297mm' : '210mm';
        const pageHeight = orientation === 'landscape' ? '210mm' : '297mm';

        const printHTML = [
            '<!DOCTYPE html>',
            '<html>',
            '<head>',
            '<meta charset="UTF-8">',
            '<title>Print Tickets</title>',
            '<style>',
            '@page {',
            '    margin: 10mm;',
            '    size: A4 ' + orientation + ';',
            '}',
            '* {',
            '    margin: 0;',
            '    padding: 0;',
            '    box-sizing: border-box;',
            '    -webkit-print-color-adjust: exact !important;',
            '    color-adjust: exact !important;',
            '    print-color-adjust: exact !important;',
            '}',
            'body {',
            '    margin: 0;',
            '    padding: 0;',
            '    font-family: Arial, sans-serif;',
            '    background: white;',
            '}',
            '.a4-preview {',
            '    display: block;',
            '    background: white;',
            '}',
            '.preview-page {',
            '    width: ' + pageWidth + ';',
            '    height: ' + pageHeight + ';',
            '    padding: 10mm;',
            '    box-sizing: border-box;',
            '    page-break-after: always;',
            '    background: white;',
            '    display: grid;',
            '    justify-content: center;',
            '    align-content: start;',
            '    position: relative;',
            '    margin: 0;',
            '    overflow: hidden;',
            '}',
            '.preview-page:last-child {',
            '    page-break-after: avoid;',
            '}',
            '.page-number {',
            '    display: none !important;',
            '}',
            '.preview-ticket {',
            '    position: relative;',
            '    background: white;',
            '    border: 1px solid #ddd;',
            '    overflow: hidden;',
            '}',
            '.ticket-bg {',
            '    position: absolute;',
            '    top: 0;',
            '    left: 0;',
            '    width: 100%;',
            '    height: 100%;',
            '    background-repeat: no-repeat;',
            '    -webkit-print-color-adjust: exact !important;',
            '    color-adjust: exact !important;',
            '    print-color-adjust: exact !important;',
            backgroundImage ? '    background-image: url(' + backgroundImage + ');' : '',
            backgroundImage ? '    background-size: ' + getBackgroundSizeCSS(backgroundFitMode).backgroundSize + ';' : '',
            backgroundImage ? '    background-position: ' + getBackgroundSizeCSS(backgroundFitMode).backgroundPosition + ';' : '',
            '}',
            '.ticket-text {',
            '    position: absolute;',
            '    z-index: 10;',
            '    box-sizing: border-box;',
            '    padding: 1px;',
            '    line-height: 1.2;',
            '    word-wrap: break-word;',
            '}',
            '.cut-lines-container {',
            '    position: absolute;',
            '    pointer-events: none;',
            '    z-index: 5;',
            '    -webkit-print-color-adjust: exact !important;',
            '    color-adjust: exact !important;',
            '    print-color-adjust: exact !important;',
            '}',
            '.cut-lines-container div {',
            '    -webkit-print-color-adjust: exact !important;',
            '    color-adjust: exact !important;',
            '    print-color-adjust: exact !important;',
            '}',
            'img[data-canvas-placeholder] {',
            '    display: block;',
            '}',
            '</style>',
            '</head>',
            '<body>',
            '<div class="a4-preview">',
            previewHTML,
            '</div>',
            '<script>',
            'window.onload = function() {',
            '    var images = document.querySelectorAll("img, [style*=background-image]");',
            '    var loaded = 0;',
            '    var total = 0;',
            '    images.forEach(function(el) {',
            '        if (el.tagName === "IMG") { total++; }',
            '    });',
            '    function tryPrint() {',
            '        setTimeout(function() { window.print(); }, 300);',
            '    }',
            '    if (total === 0) {',
            '        tryPrint();',
            '    } else {',
            '        images.forEach(function(el) {',
            '            if (el.tagName === "IMG") {',
            '                if (el.complete) {',
            '                    loaded++;',
            '                    if (loaded >= total) tryPrint();',
            '                } else {',
            '                    el.onload = function() {',
            '                        loaded++;',
            '                        if (loaded >= total) tryPrint();',
            '                    };',
            '                    el.onerror = function() {',
            '                        loaded++;',
            '                        if (loaded >= total) tryPrint();',
            '                    };',
            '                }',
            '            }',
            '        });',
            '        setTimeout(tryPrint, 3000);',
            '    }',
            '};',
            '<\/script>',
            '</body>',
            '</html>'
        ].join('\n');

        // Open print window
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            hideLoading();
            showToast('error', 'Popup Blocked', 'Please allow popups for this site, then try printing again.');
            return;
        }

        printWindow.document.write(printHTML);
        printWindow.document.close();
        hideLoading();
    }

    if (canvases.length > 0) {
        processCanvasBatch();
    } else {
        finalizePrint();
    }
}

function exportProject() {
    const projectData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        csvData: csvData,
        csvHeaders: csvHeaders,
        backgroundImage: backgroundImage,
        ticketSettings: {
            type: document.getElementById('ticket-type').value,
            width: document.getElementById('ticket-width').value,
            height: document.getElementById('ticket-height').value,
            fitMode: backgroundFitMode
        },
        printSettings: {
            ticketGap: document.getElementById('ticket-gap').value
        },
        labelSettings: {
            labelColumn: labelColumn,
            labelColors: labelColors,
            labelBlockWidth: labelBlockWidth,
            labelBlockPosition: { ...labelBlockPosition }
        },
        elements: []
    };

    // Collect all elements and their properties
    const allElements = document.querySelectorAll('.text-element, .qr-element');
    allElements.forEach(element => {
        const elementData = {
            type: element.classList.contains('qr-element') ? 'qr' : 'text',
            position: {
                left: element.style.left,
                top: element.style.top,
                width: element.offsetWidth + 'px',
                height: element.offsetHeight + 'px'
            },
            content: element.classList.contains('qr-element') ?
                element.dataset.placeholder :
                (element.dataset.textFormat || element.textContent),
            styles: {
                fontSize: element.style.fontSize,
                color: element.style.color,
                fontFamily: element.style.fontFamily,
                fontBold: element.dataset.fontBold === 'true',
                textAlign: element.style.textAlign || 'center',
                horizontalAlign: element.dataset.horizontalAlign || 'center',
                verticalAlign: element.dataset.verticalAlign || 'center',
                rotation: parseInt(element.dataset.rotation) || 0
            },
            allowOverflow: element.dataset.allowOverflow === 'true',
            containInBox: element.dataset.containInBox === 'true',
            disableNewLine: element.dataset.disableNewLine === 'true'
        };

        // Add QR/Barcode-specific properties
        if (element.classList.contains('qr-element')) {
            // Get actual current size from element dimensions, not dataset
            const actualSize = Math.min(element.offsetWidth, element.offsetHeight);

            elementData.codeSettings = {
                codeType: element.dataset.codeType || 'qr',
                size: actualSize.toString(),
                background: element.dataset.codeBackground || '#ffffff',
                foreground: element.dataset.codeForeground || '#000000'
            };

            if (element.dataset.codeType === 'barcode') {
                elementData.codeSettings.barcodeType = element.dataset.barcodeType || 'CODE128';
            }
            if (element.dataset.customLogo) {
                elementData.codeSettings.customLogo = element.dataset.customLogo;
            }
        }

        projectData.elements.push(elementData);
    });

    // Create and download the file
    const jsonString = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket_project_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.veenttix`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('Project exported successfully');
}

function importProject(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const projectData = JSON.parse(e.target.result);

            // Clear existing data
            clearProject();

            // Restore CSV data
            if (projectData.csvData && projectData.csvHeaders) {
                csvData = projectData.csvData;
                csvHeaders = projectData.csvHeaders;
                displayHeaders();
                updateLabelColumnDropdown();
                updateQRColumnDropdown();
            }

            // Restore background image
            if (projectData.backgroundImage) {
                backgroundImage = projectData.backgroundImage;
                const canvas = document.getElementById('canvas-background');
                canvas.style.backgroundImage = `url(${backgroundImage})`;
            }

            // Restore ticket settings
            if (projectData.ticketSettings) {
                if (projectData.ticketSettings.type) {
                    document.getElementById('ticket-type').value = projectData.ticketSettings.type;
                }
                document.getElementById('ticket-width').value = projectData.ticketSettings.width;
                document.getElementById('ticket-height').value = projectData.ticketSettings.height;
                // Restore fit mode (backward-compatible, defaults to 'cover')
                backgroundFitMode = projectData.ticketSettings.fitMode || 'cover';
                document.getElementById('bg-fit-mode').value = backgroundFitMode;
                applyBackgroundFitMode();
                updateTicketType();
            }

            // Restore print settings
            if (projectData.printSettings) {
                document.getElementById('ticket-gap').value = projectData.printSettings.ticketGap;
            }

            // Restore label settings
            if (projectData.labelSettings) {
                labelColumn = projectData.labelSettings.labelColumn || '';
                labelColors = projectData.labelSettings.labelColors || {};
                labelBlockWidth = projectData.labelSettings.labelBlockWidth || 10;
                labelBlockPosition = projectData.labelSettings.labelBlockPosition || { left: 0, top: 0 };

                document.getElementById('label-column').value = labelColumn;
                document.getElementById('label-block-width').value = labelBlockWidth;
                document.getElementById('label-block-width-value').textContent = labelBlockWidth + 'px';

                if (labelColumn) {
                    updateLabelColumn();
                }
            }

            // Restore elements
            if (projectData.elements) {
                projectData.elements.forEach(elementData => {
                    restoreElement(elementData);
                });
            }

            // Update lists and preview
            updateElementsList();
            updatePreview();

            console.log('Project imported successfully');
            alert('Project imported successfully!');

        } catch (error) {
            console.error('Error importing project:', error);
            alert('Error importing project. Please check the file format.');
        }
    };

    reader.readAsText(file);

    // Reset the input so the same file can be selected again
    event.target.value = '';
}

function clearProject() {
    // Clear CSV data
    csvData = [];
    csvHeaders = [];
    document.getElementById('csv-headers').innerHTML = '<p class="no-csv">Upload a CSV file to see headers</p>';

    // Clear background
    backgroundImage = null;
    document.getElementById('canvas-background').style.backgroundImage = '';

    // Reset fit mode
    backgroundFitMode = 'cover';
    document.getElementById('bg-fit-mode').value = 'cover';
    applyBackgroundFitMode();

    // Clear label settings
    labelColumn = '';
    labelColors = {};
    labelBlockWidth = 50;
    labelBlockPosition = { left: 0, top: 0 };
    document.getElementById('label-column').value = '';
    document.getElementById('label-color-assignments').innerHTML = '';
    document.getElementById('label-block-controls').style.display = 'none';
    document.getElementById('label-block-width').value = 50;
    document.getElementById('label-block-width-value').textContent = '50px';
    removeLabelBlockFromCanvas();

    // Clear elements
    document.getElementById('text-elements').innerHTML = '';

    // Clear selected element
    selectedElement = null;
    selectedElements.clear();
    document.getElementById('text-properties').style.display = 'none';

    // Update lists
    updateElementsList();
}

function restoreQRCode(element, canvas, savedSize, codeSettings) {
    const codeType = codeSettings.codeType || 'qr';
    const placeholder = element.dataset.placeholder;
    const value = `{${placeholder}}`;
    const background = codeSettings.background || '#ffffff';
    const foreground = codeSettings.foreground || '#000000';
    const logoSrc = codeSettings.customLogo || element.dataset.customLogo || undefined;

    if (codeType === 'qr') {
        // Generate QR Code with saved size
        element.style.width = `${savedSize}px`;
        element.style.height = `${savedSize}px`;

        const qr = new QRious({
            element: canvas,
            value: value,
            size: savedSize,
            background: background,
            foreground: foreground
        });
        canvas.qr = qr;

        // Add logo to QR code
        setTimeout(() => addLogoToQR(canvas, savedSize, logoSrc), 100);
    } else {
        // Generate Barcode with saved size
        const barcodeType = codeSettings.barcodeType || 'CODE128';
        const barcodeWidth = Math.max(savedSize * 2, 200);
        const barcodeHeight = Math.max(savedSize * 0.6, 60);

        element.style.width = `${barcodeWidth}px`;
        element.style.height = `${barcodeHeight}px`;

        try {
            JsBarcode(canvas, value, {
                format: barcodeType,
                width: 2,
                height: barcodeHeight - 20,
                displayValue: true,
                background: background,
                lineColor: foreground,
                fontSize: 12
            });
        } catch (error) {
            // Fallback to CODE128 if the barcode type fails
            JsBarcode(canvas, value, {
                format: 'CODE128',
                width: 2,
                height: barcodeHeight - 20,
                displayValue: true,
                background: background,
                lineColor: foreground,
                fontSize: 12
            });
        }
    }
}

function restoreElement(elementData) {
    const container = document.getElementById('text-elements');

    if (elementData.type === 'qr') {
        // Create QR/Barcode element
        const qrElement = document.createElement('div');
        qrElement.className = 'qr-element';
        qrElement.style.left = elementData.position.left;
        qrElement.style.top = elementData.position.top;
        qrElement.style.width = elementData.position.width;
        qrElement.style.height = elementData.position.height;
        qrElement.dataset.placeholder = elementData.content;

        // Handle both old qrSettings and new codeSettings format
        const codeSettings = elementData.codeSettings || elementData.qrSettings || {};
        qrElement.dataset.codeType = codeSettings.codeType || 'qr';
        qrElement.dataset.codeSize = codeSettings.size || '100';
        qrElement.dataset.codeBackground = codeSettings.background || '#ffffff';
        qrElement.dataset.codeForeground = codeSettings.foreground || '#000000';
        if (codeSettings.barcodeType) {
            qrElement.dataset.barcodeType = codeSettings.barcodeType;
        }
        if (codeSettings.customLogo) {
            qrElement.dataset.customLogo = codeSettings.customLogo;
        }

        const canvas = document.createElement('canvas');
        qrElement.appendChild(canvas);

        // Restore the QR code with the saved size, not the UI default
        const savedSize = parseInt(codeSettings.size) || 100;
        restoreQRCode(qrElement, canvas, savedSize, codeSettings);

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        qrElement.appendChild(resizeHandle);

        // Add both mouse and touch event support
    qrElement.addEventListener('mousedown', startDrag);
    qrElement.addEventListener('touchstart', startDrag);
        resizeHandle.addEventListener('mousedown', startResize);
    resizeHandle.addEventListener('touchstart', startResize);
        qrElement.addEventListener('click', selectElement);

        container.appendChild(qrElement);
    } else {
        // Create text element
        const textElement = document.createElement('div');
        const containInBox = elementData.containInBox !== undefined ? elementData.containInBox : !elementData.allowOverflow;
        textElement.className = 'text-element' + (containInBox ? ' contain-box' : '');
        textElement.textContent = elementData.content;
        textElement.dataset.textFormat = elementData.content;
        textElement.dataset.allowOverflow = elementData.allowOverflow.toString();
        textElement.dataset.containInBox = containInBox.toString();
        const disableNewLine = elementData.disableNewLine || false;
        textElement.dataset.disableNewLine = disableNewLine.toString();
        const fontBold = elementData.styles.fontBold || false;
        textElement.dataset.fontBold = fontBold.toString();
        textElement.style.left = elementData.position.left;
        textElement.style.top = elementData.position.top;
        textElement.style.width = elementData.position.width;
        textElement.style.height = elementData.position.height;
        textElement.style.fontSize = elementData.styles.fontSize;
        textElement.style.color = elementData.styles.color;
        textElement.style.fontFamily = elementData.styles.fontFamily;
        textElement.style.fontWeight = fontBold ? 'bold' : 'normal';
        const hAlign = elementData.styles.horizontalAlign || elementData.styles.textAlign || 'center';
        const vAlign = elementData.styles.verticalAlign || 'center';
        textElement.style.textAlign = hAlign;
        textElement.dataset.horizontalAlign = hAlign;
        textElement.dataset.verticalAlign = vAlign;
        textElement.style.display = 'flex';
        textElement.style.alignItems = vAlign === 'center' ? 'center' : vAlign === 'bottom' ? 'flex-end' : 'flex-start';
        textElement.style.justifyContent = hAlign === 'center' ? 'center' : hAlign === 'right' ? 'flex-end' : 'flex-start';
        textElement.style.lineHeight = '1.2';
        const rotation = elementData.styles.rotation || 0;
        textElement.dataset.rotation = rotation.toString();
        if (rotation !== 0) {
            textElement.style.transform = `rotate(${rotation}deg)`;
        }
        if (disableNewLine) {
            textElement.style.whiteSpace = 'nowrap';
        }

        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'rotate-handle';
        textElement.appendChild(rotateHandle);

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        textElement.appendChild(resizeHandle);

        // Add both mouse and touch event support
    textElement.addEventListener('mousedown', startDrag);
    textElement.addEventListener('touchstart', startDrag);
        resizeHandle.addEventListener('mousedown', startResize);
    resizeHandle.addEventListener('touchstart', startResize);
        rotateHandle.addEventListener('mousedown', startRotate);
    rotateHandle.addEventListener('touchstart', startRotate);
        textElement.addEventListener('click', selectElement);

        container.appendChild(textElement);
        applyAutoFitToElement(textElement);
    }
}


function createDesignCanvasTicket(rowData) {
    const ticketWidth = parseFloat(document.getElementById('ticket-width').value) || 85;
    const ticketHeight = parseFloat(document.getElementById('ticket-height').value) || 54;
    const scale = 4; // Same scale as design canvas

    const ticket = document.createElement('div');
    ticket.className = 'png-design-ticket';
    ticket.style.width = `${ticketWidth * scale}px`;
    ticket.style.height = `${ticketHeight * scale}px`;
    ticket.style.position = 'relative';
    ticket.style.background = 'white';
    ticket.style.border = '2px solid #ddd';
    ticket.style.borderRadius = '5px';
    ticket.style.overflow = 'hidden';

    // Add background image if exists
    if (backgroundImage) {
        const bg = document.createElement('div');
        bg.style.position = 'absolute';
        bg.style.top = '0';
        bg.style.left = '0';
        bg.style.width = '100%';
        bg.style.height = '100%';
        bg.style.backgroundImage = `url(${backgroundImage})`;
        const fitCSS = getBackgroundSizeCSS(backgroundFitMode);
        bg.style.backgroundSize = fitCSS.backgroundSize;
        bg.style.backgroundPosition = fitCSS.backgroundPosition;
        bg.style.backgroundRepeat = 'no-repeat';
        ticket.appendChild(bg);
    }

    // Add label color block
    const labelData = getLabelBlockRenderData(rowData);
    if (labelData) {
        const labelDiv = document.createElement('div');
        labelDiv.style.position = 'absolute';
        labelDiv.style.left = `${labelData.left}px`;
        labelDiv.style.top = '0';
        labelDiv.style.width = `${labelData.width}px`;
        labelDiv.style.height = '100%';
        labelDiv.style.backgroundColor = labelData.color;
        labelDiv.style.zIndex = '5';
        ticket.appendChild(labelDiv);
    }

    // Add all elements exactly as they appear in design canvas
    const allElements = document.querySelectorAll('.text-element, .qr-element');
    allElements.forEach(element => {
        const leftPx = parseFloat(element.style.left) || 0;
        const topPx = parseFloat(element.style.top) || 0;
        const widthPx = parseFloat(element.style.width) || element.offsetWidth;
        const heightPx = parseFloat(element.style.height) || element.offsetHeight;

        if (element.classList.contains('qr-element')) {
            const qrDiv = document.createElement('div');
            qrDiv.style.position = 'absolute';
            qrDiv.style.left = `${leftPx}px`;
            qrDiv.style.top = `${topPx}px`;
            qrDiv.style.width = `${widthPx}px`;
            qrDiv.style.height = `${heightPx}px`;
            qrDiv.style.display = 'flex';
            qrDiv.style.alignItems = 'center';
            qrDiv.style.justifyContent = 'center';

            const placeholder = element.dataset.placeholder;
            const textFormat = `{${placeholder}}`;
            const codeValue = formatTextWithData(textFormat, rowData);
            const codeType = element.dataset.codeType || 'qr';

            const canvas = document.createElement('canvas');

            if (codeType === 'qr') {
                const qrSize = Math.min(widthPx, heightPx);
                const qr = new QRious({
                    element: canvas,
                    value: codeValue,
                    size: qrSize,
                    background: element.dataset.codeBackground || '#ffffff',
                    foreground: element.dataset.codeForeground || '#000000'
                });

                // Add logo to QR code
                const previewLogoSrc = element.dataset.customLogo || undefined;
                setTimeout(() => addLogoToQR(canvas, qrSize, previewLogoSrc), 100);
            } else {
                const barcodeType = element.dataset.barcodeType || 'CODE128';
                const background = element.dataset.codeBackground || '#ffffff';
                const foreground = element.dataset.codeForeground || '#000000';
                try {
                    JsBarcode(canvas, codeValue, {
                        format: barcodeType,
                        width: 2,
                        height: heightPx - 20,
                        displayValue: true,
                        background: background,
                        lineColor: foreground,
                        fontSize: 12
                    });
                } catch (error) {
                    JsBarcode(canvas, codeValue, {
                        format: 'CODE128',
                        width: 2,
                        height: heightPx - 20,
                        displayValue: true,
                        background: background,
                        lineColor: foreground,
                        fontSize: 12
                    });
                }
            }

            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.objectFit = 'contain';
            qrDiv.appendChild(canvas);
            ticket.appendChild(qrDiv);
        } else {
            const text = document.createElement('div');
            text.style.position = 'absolute';
            text.style.left = `${leftPx}px`;
            text.style.top = `${topPx}px`;
            text.style.width = `${widthPx}px`;
            text.style.height = `${heightPx}px`;
            text.style.color = element.style.color;
            text.style.fontFamily = element.style.fontFamily;
            text.style.fontWeight = element.dataset.fontBold === 'true' ? 'bold' : 'normal';
            const hAlign = element.dataset.horizontalAlign || element.style.textAlign || 'center';
            const vAlign = element.dataset.verticalAlign || 'center';
            text.style.textAlign = hAlign;
            text.style.display = 'flex';
            text.style.alignItems = vAlign === 'center' ? 'center' : vAlign === 'bottom' ? 'flex-end' : 'flex-start';
            text.style.justifyContent = hAlign === 'center' ? 'center' : hAlign === 'right' ? 'flex-end' : 'flex-start';
            text.style.padding = '2px';
            text.style.boxSizing = 'border-box';

            // Apply rotation
            const rotation = parseInt(element.dataset.rotation) || 0;
            if (rotation !== 0) {
                text.style.transform = `rotate(${rotation}deg)`;
            }

            const textFormat = element.dataset.textFormat || element.textContent;
            const formattedText = formatTextWithData(textFormat, rowData);
            text.textContent = formattedText;

            // Auto-fit or manual font size
            const containInBox = element.dataset.containInBox === 'true';
            const isBold = element.dataset.fontBold === 'true';
            const noWrap = element.dataset.disableNewLine === 'true';
            if (containInBox) {
                const autoSize = autoFitFontSize(formattedText, widthPx, heightPx, element.style.fontFamily || 'Arial', isBold, noWrap);
                text.style.fontSize = `${autoSize}px`;
            } else {
                text.style.fontSize = element.style.fontSize;
            }

            // Apply whiteSpace for disableNewLine
            if (noWrap) {
                text.style.whiteSpace = 'nowrap';
            }

            // Handle overflow setting - containInBox overrides allowOverflow
            const allowOverflow = element.dataset.allowOverflow === 'true';
            if (containInBox || !allowOverflow) {
                text.style.overflow = 'hidden';
                if (!noWrap) {
                    text.style.wordWrap = 'break-word';
                }
            } else {
                text.style.overflow = 'visible';
                text.style.whiteSpace = 'nowrap';
            }

            ticket.appendChild(text);
        }
    });

    return ticket;
}

let pngPreviewDirty = true;

function updatePNGPreview() {
    pngPreviewDirty = true;
    // Only rebuild when the PNG export tab is actually visible
    const pngTab = document.getElementById('png-export-tab');
    if (!pngTab || !pngTab.classList.contains('active')) return;
    rebuildPNGPreview();
}

function rebuildPNGPreview() {
    pngPreviewDirty = false;
    const pngGrid = document.getElementById('png-tickets-grid');

    if (csvData.length === 0) {
        pngGrid.innerHTML = '<p>PNG previews will appear here after uploading CSV data</p>';
        const totalElement = document.getElementById('total-export-tickets');
        if (totalElement) totalElement.textContent = '0';
        return;
    }

    const totalElement = document.getElementById('total-export-tickets');
    const progressElement = document.getElementById('export-progress');
    if (totalElement) totalElement.textContent = csvData.length;
    if (progressElement) progressElement.textContent = '0/' + csvData.length;

    pngGrid.innerHTML = '';

    const ticketWidth = parseFloat(document.getElementById('ticket-width').value) || 85;
    const ticketHeight = parseFloat(document.getElementById('ticket-height').value) || 54;
    const scale = 4; // Design canvas scale

    // Get actual container width dynamically
    const tempDiv = document.createElement('div');
    tempDiv.className = 'png-ticket-preview';
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.position = 'absolute';
    pngGrid.appendChild(tempDiv);
    const containerWidth = tempDiv.offsetWidth - 30; // Subtract padding
    pngGrid.removeChild(tempDiv);

    const ticketDisplayWidth = ticketWidth * scale;
    const ticketDisplayHeight = ticketHeight * scale;

    // Calculate scale factor to fit width
    const scaleFactor = containerWidth / ticketDisplayWidth;
    const finalScale = Math.min(scaleFactor, 1); // Don't scale up, only down

    csvData.forEach((rowData, index) => {
        const pngTicketDiv = document.createElement('div');
        pngTicketDiv.className = 'png-ticket-preview';

        const ticket = createDesignCanvasTicket(rowData);

        const ticketContainer = document.createElement('div');
        ticketContainer.className = 'png-ticket-container';
        ticketContainer.style.width = `${ticketDisplayWidth * finalScale}px`;
        ticketContainer.style.height = `${ticketDisplayHeight * finalScale}px`;
        ticketContainer.style.overflow = 'hidden';
        ticketContainer.style.position = 'relative';
        ticketContainer.style.margin = '0 auto'; // Center the ticket

        // Apply scaling if needed
        if (finalScale < 1) {
            ticket.style.transform = `scale(${finalScale})`;
            ticket.style.transformOrigin = 'top left';
        }

        ticketContainer.appendChild(ticket);

        const ticketInfo = document.createElement('div');
        ticketInfo.className = 'png-ticket-info';
        ticketInfo.innerHTML = `
            <h4>Row ${index + 1}</h4>
            <p><strong>Filename:</strong> ${getFilename(rowData)}.png</p>
            <p><strong>Data:</strong> ${Object.entries(rowData).slice(0, 3).map(([key, value]) => `${key}: ${value}`).join(', ')}${Object.entries(rowData).length > 3 ? '...' : ''}</p>
        `;

        pngTicketDiv.appendChild(ticketContainer);
        pngTicketDiv.appendChild(ticketInfo);
        pngGrid.appendChild(pngTicketDiv);
    });
}

function getFilename(rowData) {
    const firstColumnValue = Object.values(rowData)[0] || 'ticket';
    // Clean filename: remove special characters and spaces
    return firstColumnValue.toString().replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
}

async function exportAllAsPNG() {
    if (csvData.length === 0) {
        alert('Please upload a CSV file first');
        return;
    }

    const quality = parseFloat(document.getElementById('png-quality').value) || 2;
    const ticketWidth = parseFloat(document.getElementById('ticket-width').value) || 85;
    const ticketHeight = parseFloat(document.getElementById('ticket-height').value) || 54;

    // Convert mm to pixels (assuming 96 DPI base, then multiply by quality)
    const mmToPixel = 3.779527559 * quality;
    const canvasWidth = ticketWidth * mmToPixel;
    const canvasHeight = ticketHeight * mmToPixel;

    // Create JSZip instance
    const zip = new JSZip();

    let exportCount = 0;
    const totalTickets = csvData.length;

    // Update button to show processing
    const exportButton = event.target;
    const originalText = exportButton.innerHTML;
    exportButton.disabled = true;
    exportButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        for (let i = 0; i < csvData.length; i++) {
            const rowData = csvData[i];
            const filename = getFilename(rowData);

            document.getElementById('export-progress').textContent = `${exportCount + 1}/${totalTickets}`;

            try {
                // Ensure canvas has valid dimensions
                const validWidth = Math.max(100, Math.floor(canvasWidth));
                const validHeight = Math.max(100, Math.floor(canvasHeight));

                const canvas = document.createElement('canvas');
                canvas.width = validWidth;
                canvas.height = validHeight;
                const ctx = canvas.getContext('2d');

                // Set white background
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, validWidth, validHeight);

                // Draw background image if exists
                if (backgroundImage) {
                    await new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                            drawBackgroundOnCanvas(ctx, img, validWidth, validHeight, backgroundFitMode);
                            resolve();
                        };
                        img.onerror = () => resolve(); // Continue if image fails to load
                        img.src = backgroundImage;
                    });
                }

                // Draw label color block
                const labelRenderData = getLabelBlockRenderData(rowData);
                if (labelRenderData) {
                    const canvasRectLabel = document.getElementById('ticket-canvas').getBoundingClientRect();
                    const blockLeftPercent = labelRenderData.left / canvasRectLabel.width;
                    const blockWidthPercent = labelRenderData.width / canvasRectLabel.width;

                    ctx.fillStyle = labelRenderData.color;
                    ctx.fillRect(
                        blockLeftPercent * validWidth,
                        0,
                        blockWidthPercent * validWidth,
                        validHeight
                    );
                }

                // Draw all elements
                const allElements = document.querySelectorAll('.text-element, .qr-element');
                const canvasRect = document.getElementById('ticket-canvas').getBoundingClientRect();

                for (const element of allElements) {
                    const leftPx = parseFloat(element.style.left) || 0;
                    const topPx = parseFloat(element.style.top) || 0;
                    const widthPx = parseFloat(element.style.width) || element.offsetWidth;
                    const heightPx = parseFloat(element.style.height) || element.offsetHeight;

                    const leftPercent = (leftPx / canvasRect.width);
                    const topPercent = (topPx / canvasRect.height);
                    const widthPercent = (widthPx / canvasRect.width);
                    const heightPercent = (heightPx / canvasRect.height);

                    const x = leftPercent * validWidth;
                    const y = topPercent * validHeight;
                    const w = widthPercent * validWidth;
                    const h = heightPercent * validHeight;

                    if (element.classList.contains('qr-element')) {
                        // Handle QR/Barcode elements
                        const placeholder = element.dataset.placeholder;
                        const textFormat = `{${placeholder}}`;
                        const codeValue = formatTextWithData(textFormat, rowData);
                        const codeType = element.dataset.codeType || 'qr';

                        // Ensure minimum size to prevent 0 width/height canvas
                        const minSize = 20;
                        const canvasW = Math.max(minSize, Math.floor(w));
                        const canvasH = Math.max(minSize, Math.floor(h));

                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = canvasW;
                        tempCanvas.height = canvasH;

                        if (codeType === 'qr') {
                            try {
                                const qrSize = Math.min(canvasW, canvasH);
                                const qr = new QRious({
                                    element: tempCanvas,
                                    value: codeValue,
                                    size: qrSize,
                                    background: element.dataset.codeBackground || '#ffffff',
                                    foreground: element.dataset.codeForeground || '#000000'
                                });

                                // Add logo to QR code for PNG export
                                const exportLogoSrc = element.dataset.customLogo || undefined;
                                addLogoToQR(tempCanvas, qrSize, exportLogoSrc);
                            } catch (qrError) {
                                console.warn('QR generation failed:', qrError);
                                continue; // Skip this element
                            }
                        } else {
                            const barcodeType = element.dataset.barcodeType || 'CODE128';
                            try {
                                JsBarcode(tempCanvas, codeValue, {
                                    format: barcodeType,
                                    width: Math.max(1, Math.floor(2 * quality)),
                                    height: Math.max(20, Math.floor(canvasH - (20 * quality))),
                                    displayValue: true,
                                    background: element.dataset.codeBackground || '#ffffff',
                                    lineColor: element.dataset.codeForeground || '#000000',
                                    fontSize: Math.max(8, Math.floor(12 * quality))
                                });
                            } catch (error) {
                                try {
                                    JsBarcode(tempCanvas, codeValue, {
                                        format: 'CODE128',
                                        width: Math.max(1, Math.floor(2 * quality)),
                                        height: Math.max(20, Math.floor(canvasH - (20 * quality))),
                                        displayValue: true,
                                        background: element.dataset.codeBackground || '#ffffff',
                                        lineColor: element.dataset.codeForeground || '#000000',
                                        fontSize: Math.max(8, Math.floor(12 * quality))
                                    });
                                } catch (fallbackError) {
                                    console.warn('Barcode generation failed:', fallbackError);
                                    continue; // Skip this element
                                }
                            }
                        }

                        // Only draw if canvas has valid dimensions
                        if (tempCanvas.width > 0 && tempCanvas.height > 0) {
                            ctx.drawImage(tempCanvas, x, y);
                        }
                    } else {
                        // Handle text elements
                        const textFormat = element.dataset.textFormat || element.textContent;
                        const text = formatTextWithData(textFormat, rowData);
                        const fontFamily = element.style.fontFamily || 'Arial';
                        const isBold = element.dataset.fontBold === 'true';
                        const fontWeight = isBold ? 'bold ' : '';

                        // Determine font size: auto-fit or manual
                        const containInBox = element.dataset.containInBox === 'true';
                        const noWrap = element.dataset.disableNewLine === 'true';
                        let fontSize;
                        if (containInBox) {
                            fontSize = autoFitFontSize(text, w, h, fontFamily, isBold, noWrap);
                        } else {
                            fontSize = parseInt(element.style.fontSize) * quality;
                        }

                        ctx.save();

                        // Apply rotation around element center
                        const rotation = parseInt(element.dataset.rotation) || 0;
                        if (rotation !== 0) {
                            const cx = x + w / 2;
                            const cy = y + h / 2;
                            ctx.translate(cx, cy);
                            ctx.rotate(rotation * Math.PI / 180);
                            ctx.translate(-cx, -cy);
                        }

                        ctx.fillStyle = element.style.color || '#000000';
                        ctx.font = `${fontWeight}${fontSize}px ${fontFamily}`;
                        const hAlign = element.dataset.horizontalAlign || element.style.textAlign || 'center';
                        const vAlign = element.dataset.verticalAlign || 'center';
                        ctx.textAlign = hAlign;
                        ctx.textBaseline = 'top';

                        // Handle horizontal alignment
                        let textX = x;
                        if (hAlign === 'center') {
                            textX = x + w / 2;
                        } else if (hAlign === 'right') {
                            textX = x + w;
                        }

                        // Handle overflow setting - containInBox overrides allowOverflow
                        const allowOverflow = element.dataset.allowOverflow === 'true';
                        if (!containInBox && allowOverflow) {
                            const textY = computeVerticalY(y, h, fontSize, 1, vAlign);
                            ctx.fillText(text, textX, textY);
                        } else if (noWrap) {
                            // Single line - no wrapping
                            const textY = computeVerticalY(y, h, fontSize, 1, vAlign);
                            ctx.fillText(text, textX, textY);
                        } else {
                            // Wrap text within bounds
                            const lineHeight = fontSize * 1.2;
                            const lines = getWrappedLines(ctx, text, w);
                            const totalTextHeight = lines.length * lineHeight;
                            let lineY = computeVerticalY(y, h, totalTextHeight, lines.length, vAlign);
                            for (const line of lines) {
                                if (lineY + lineHeight > y + h && containInBox) break;
                                ctx.fillText(line, textX, lineY);
                                lineY += lineHeight;
                            }
                        }
                        ctx.restore();
                    }
                }

                // Convert canvas to blob and add to zip
                await new Promise((resolve, reject) => {
                    canvas.toBlob((blob) => {
                        if (blob && blob.size > 0) {
                            zip.file(`${filename}.png`, blob);
                            console.log(`Added ${filename}.png to zip (${blob.size} bytes)`);
                        } else {
                            console.warn(`Failed to create blob for ${filename}`);
                        }
                        exportCount++;
                        document.getElementById('export-progress').textContent = `${exportCount}/${totalTickets}`;
                        resolve();
                    }, 'image/png', 0.9);
                });

            } catch (error) {
                console.error('Error processing row', i, ':', error);
                exportCount++;
            }

            // Small delay to prevent browser freeze
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        // Generate and download zip file
        exportButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating ZIP...';

        console.log('ZIP contents:', Object.keys(zip.files));
        console.log('ZIP file count:', Object.keys(zip.files).length);

        if (Object.keys(zip.files).length === 0) {
            throw new Error('No files were added to the ZIP. Check the console for errors.');
        }

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        console.log('Generated ZIP size:', zipBlob.size);

        if (zipBlob.size === 0) {
            throw new Error('Generated ZIP file is empty.');
        }

        // Create download link
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tickets_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Show success message
        alert(`Export complete! ${exportCount} PNG files have been packaged into a ZIP file and downloaded.`);

    } catch (error) {
        console.error('Error during export:', error);
        alert('An error occurred during export. Please try again.');
    } finally {
        // Reset button
        exportButton.disabled = false;
        exportButton.innerHTML = originalText;
        document.getElementById('export-progress').textContent = `${exportCount}/${totalTickets}`;
    }
}

function showMobileProperties(element) {
    const mobileProps = document.getElementById('mobile-text-properties');
    const content = mobileProps.querySelector('.mobile-properties-content');

    // Clone the desktop properties panel
    const desktopProps = document.getElementById('text-properties');
    content.innerHTML = desktopProps.innerHTML;

    // Show the mobile properties panel
    mobileProps.classList.add('show');
}

function closeMobileProperties() {
    const mobileProps = document.getElementById('mobile-text-properties');
    mobileProps.classList.remove('show');
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleButton = document.querySelector('.mobile-sidebar-toggle');

    sidebar.classList.toggle('mobile-open');

    // Update button text and icon
    if (sidebar.classList.contains('mobile-open')) {
        toggleButton.innerHTML = '<i class="fas fa-times"></i> Close Tools';
    } else {
        toggleButton.innerHTML = '<i class="fas fa-cog"></i> Tools';
    }
}

// ==========================================
// Canvas Zoom
// ==========================================

function setCanvasZoom(newZoom) {
    newZoom = Math.round(Math.min(3, Math.max(0.25, newZoom)) * 100) / 100;
    if (newZoom === canvasZoom) return;
    canvasZoom = newZoom;

    const canvas = document.getElementById('ticket-canvas');
    const designArea = document.querySelector('.design-area');
    if (canvasZoom === 1) {
        canvas.style.transform = '';
        canvas.style.marginRight = '';
        canvas.style.marginBottom = '';
        designArea.style.justifyContent = 'center';
    } else {
        canvas.style.transform = `scale(${canvasZoom})`;
        canvas.style.transformOrigin = '0 0';
        // Switch to flex-start so the full zoomed canvas is scrollable
        designArea.style.justifyContent = 'flex-start';
        // Expand margins so the parent scrolls to accommodate the visual size
        const w = canvas.offsetWidth;
        const h = canvas.offsetHeight;
        canvas.style.marginRight = `${w * (canvasZoom - 1) + 20}px`;
        canvas.style.marginBottom = `${h * (canvasZoom - 1) + 20}px`;
    }

    updateZoomIndicator();
}

function updateZoomIndicator() {
    let indicator = document.getElementById('zoom-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'zoom-indicator';
        document.querySelector('.design-area').appendChild(indicator);
    }
    indicator.textContent = Math.round(canvasZoom * 100) + '%';
    indicator.style.display = canvasZoom === 1 ? 'none' : '';
}

function resetCanvasZoom() {
    setCanvasZoom(1);
}

// ==========================================
// Multi-select, Copy/Paste, Keyboard Shortcuts
// ==========================================

function saveUndoState() {
    undoStack.push(document.getElementById('text-elements').innerHTML);
    if (undoStack.length > MAX_UNDO_STATES) undoStack.shift();
    redoStack = [];
}

function undo() {
    if (undoStack.length === 0) return;
    const container = document.getElementById('text-elements');
    redoStack.push(container.innerHTML);
    container.innerHTML = undoStack.pop();
    reattachElementListeners();
    selectedElement = null;
    selectedElements.clear();
    document.getElementById('text-properties').style.display = 'none';
    updateElementsList();
    updatePreview();
    updatePNGPreview();
}

function redo() {
    if (redoStack.length === 0) return;
    const container = document.getElementById('text-elements');
    undoStack.push(container.innerHTML);
    container.innerHTML = redoStack.pop();
    reattachElementListeners();
    selectedElement = null;
    selectedElements.clear();
    document.getElementById('text-properties').style.display = 'none';
    updateElementsList();
    updatePreview();
    updatePNGPreview();
}

function reattachElementListeners() {
    document.getElementById('text-elements').querySelectorAll('.text-element, .qr-element').forEach(el => {
        el.addEventListener('mousedown', startDrag);
        el.addEventListener('touchstart', startDrag);
        el.addEventListener('click', selectElement);

        const resizeHandle = el.querySelector('.resize-handle');
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', startResize);
            resizeHandle.addEventListener('touchstart', startResize);
        }

        const rotateHandle = el.querySelector('.rotate-handle');
        if (rotateHandle) {
            rotateHandle.addEventListener('mousedown', startRotate);
            rotateHandle.addEventListener('touchstart', startRotate);
        }

        if (el.classList.contains('qr-element')) {
            const canvas = el.querySelector('canvas');
            if (canvas) {
                const placeholder = el.dataset.placeholder;
                const value = `{${placeholder}}`;
                const size = parseInt(el.dataset.codeSize) || parseInt(el.style.width) || 100;
                const bg = el.dataset.codeBackground || '#ffffff';
                const fg = el.dataset.codeForeground || '#000000';
                const codeType = el.dataset.codeType || 'qr';

                if (codeType === 'qr' && typeof QRious !== 'undefined') {
                    try {
                        const qr = new QRious({ element: canvas, value: value, size: size, background: bg, foreground: fg });
                        canvas.qr = qr;
                        const logoSrc = el.dataset.customLogo || undefined;
                        if (logoSrc) setTimeout(() => addLogoToQR(canvas, size, logoSrc), 100);
                    } catch (e) {}
                } else if (codeType === 'barcode' && typeof JsBarcode !== 'undefined') {
                    try {
                        JsBarcode(canvas, value, {
                            format: el.dataset.barcodeType || 'CODE128',
                            width: 2, height: Math.max(30, canvas.height - 20),
                            displayValue: false, background: bg, lineColor: fg, fontSize: 12
                        });
                    } catch (e) {}
                }
            }
        }
    });
}

function selectAllElements() {
    const elements = document.querySelectorAll('#text-elements .text-element, #text-elements .qr-element');
    if (elements.length === 0) return;

    selectedElements.clear();
    elements.forEach(el => {
        el.classList.add('selected');
        selectedElements.add(el);
    });
    selectedElement = elements[elements.length - 1];
    showElementProperties(selectedElement);
}

function copySelectedElements() {
    const toCopy = selectedElements.size > 0 ? [...selectedElements] : (selectedElement ? [selectedElement] : []);
    if (toCopy.length === 0) return;

    clipboardElements = toCopy.map(el => el.cloneNode(true));
    showToast('success', 'Copied', `${clipboardElements.length} element(s) copied`);
}

function cutSelectedElements() {
    const toCut = selectedElements.size > 0 ? [...selectedElements] : (selectedElement ? [selectedElement] : []);
    if (toCut.length === 0) return;

    clipboardElements = toCut.map(el => el.cloneNode(true));
    saveUndoState();
    toCut.forEach(el => el.remove());
    selectedElements.clear();
    selectedElement = null;
    document.getElementById('text-properties').style.display = 'none';
    updateElementsList();
    updatePreview();
    updatePNGPreview();
    showToast('success', 'Cut', `${clipboardElements.length} element(s) cut`);
}

function pasteElements() {
    if (clipboardElements.length === 0) return;
    saveUndoState();

    const container = document.getElementById('text-elements');
    const pasteOffset = 15; // px offset so pasted elements don't overlap originals

    // Deselect current selection
    document.querySelectorAll('.text-element, .qr-element').forEach(el => el.classList.remove('selected'));
    selectedElements.clear();

    clipboardElements.forEach(original => {
        const clone = original.cloneNode(true);

        // Offset position
        const left = (parseFloat(clone.style.left) || 0) + pasteOffset;
        const top = (parseFloat(clone.style.top) || 0) + pasteOffset;
        clone.style.left = `${left}px`;
        clone.style.top = `${top}px`;

        // Re-attach event listeners
        clone.addEventListener('mousedown', startDrag);
        clone.addEventListener('touchstart', startDrag);
        clone.addEventListener('click', selectElement);

        const resizeHandle = clone.querySelector('.resize-handle');
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', startResize);
            resizeHandle.addEventListener('touchstart', startResize);
        }

        const rotateHandle = clone.querySelector('.rotate-handle');
        if (rotateHandle) {
            rotateHandle.addEventListener('mousedown', startRotate);
            rotateHandle.addEventListener('touchstart', startRotate);
        }

        // For QR/barcode elements, regenerate the canvas content
        if (clone.classList.contains('qr-element')) {
            const canvas = clone.querySelector('canvas');
            if (canvas) {
                const placeholder = clone.dataset.placeholder;
                const value = `{${placeholder}}`;
                const size = parseInt(clone.dataset.codeSize) || 100;
                const bg = clone.dataset.codeBackground || '#ffffff';
                const fg = clone.dataset.codeForeground || '#000000';
                const codeType = clone.dataset.codeType || 'qr';

                if (codeType === 'qr' && typeof QRious !== 'undefined') {
                    try {
                        const qr = new QRious({
                            element: canvas,
                            value: value,
                            size: size,
                            background: bg,
                            foreground: fg
                        });
                        canvas.qr = qr;
                        const logoSrc = clone.dataset.customLogo;
                        if (logoSrc) {
                            setTimeout(() => addLogoToQR(canvas, size, logoSrc), 100);
                        }
                    } catch (e) {
                        console.warn('Could not regenerate QR on paste:', e);
                    }
                } else if (codeType === 'barcode' && typeof JsBarcode !== 'undefined') {
                    try {
                        JsBarcode(canvas, value, {
                            format: clone.dataset.barcodeType || 'CODE128',
                            width: 2,
                            height: Math.max(30, canvas.height - 20),
                            displayValue: false,
                            background: bg,
                            lineColor: fg,
                            fontSize: 12
                        });
                    } catch (e) {
                        console.warn('Could not regenerate barcode on paste:', e);
                    }
                }
            }
        }

        // Select the pasted element
        clone.classList.add('selected');
        container.appendChild(clone);
        selectedElements.add(clone);
        selectedElement = clone;
    });

    // Update the stored clipboard positions so repeated pastes keep offsetting
    clipboardElements = clipboardElements.map(el => {
        const updated = el.cloneNode(true);
        updated.style.left = `${(parseFloat(el.style.left) || 0) + pasteOffset}px`;
        updated.style.top = `${(parseFloat(el.style.top) || 0) + pasteOffset}px`;
        return updated;
    });

    if (selectedElement) {
        showElementProperties(selectedElement);
    }
    updateElementsList();
    updatePreview();
    updatePNGPreview();
    showToast('success', 'Pasted', `${selectedElements.size} element(s) pasted`);
}

document.addEventListener('DOMContentLoaded', function() {
    // Check if required libraries are loaded
    checkLibrariesLoaded();

    setupCanvasDropZone();
    updateTicketType(); // Initialize with default ticket type
    populateTemplateDropdown(); // Initialize template dropdown

    document.addEventListener('click', function(event) {
        if (!event.target.closest('.text-element, .qr-element') && !event.target.closest('#text-properties')) {
            document.querySelectorAll('.text-element, .qr-element').forEach(el => el.classList.remove('selected'));
            selectedElement = null;
            selectedElements.clear();
            document.getElementById('text-properties').style.display = 'none';
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        // Only handle shortcuts when design tab is active and not typing in an input
        const activeTag = document.activeElement.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
        if (!document.getElementById('design-tab').classList.contains('active')) return;

        // Delete key - remove selected elements
        if (event.key === 'Delete' || event.key === 'Backspace') {
            if (selectedElement || selectedElements.size > 0) {
                event.preventDefault();
                deleteSelectedElement();
            }
        }

        // Ctrl+A - select all elements
        if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
            event.preventDefault();
            selectAllElements();
        }

        // Ctrl+C - copy selected elements
        if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
            event.preventDefault();
            copySelectedElements();
        }

        // Ctrl+X - cut selected elements
        if ((event.ctrlKey || event.metaKey) && event.key === 'x') {
            event.preventDefault();
            cutSelectedElements();
        }

        // Ctrl+V - paste elements
        if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
            event.preventDefault();
            pasteElements();
        }

        // Ctrl+Z - undo
        if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            undo();
        }

        // Ctrl+Y or Ctrl+Shift+Z - redo
        if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey) || (event.key === 'Z' && event.shiftKey))) {
            event.preventDefault();
            redo();
        }

        // Ctrl+Plus - zoom in
        if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '=' || event.key === 'Add')) {
            event.preventDefault();
            setCanvasZoom(canvasZoom + 0.1);
        }

        // Ctrl+Minus - zoom out
        if ((event.ctrlKey || event.metaKey) && (event.key === '-' || event.key === 'Subtract')) {
            event.preventDefault();
            setCanvasZoom(canvasZoom - 0.1);
        }

        // Ctrl+0 - reset zoom
        if ((event.ctrlKey || event.metaKey) && event.key === '0') {
            event.preventDefault();
            resetCanvasZoom();
        }
    });

    // Mouse wheel zoom on design area (Ctrl + scroll)
    document.querySelector('.design-area').addEventListener('wheel', function(event) {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();

        const oldZoom = canvasZoom;
        const step = event.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.round(Math.min(3, Math.max(0.25, canvasZoom + step)) * 100) / 100;
        if (newZoom === oldZoom) return;

        // Zoom toward cursor position
        const canvas = document.getElementById('ticket-canvas');
        const canvasRect = canvas.getBoundingClientRect();
        const mouseCanvasX = (event.clientX - canvasRect.left) / oldZoom;
        const mouseCanvasY = (event.clientY - canvasRect.top) / oldZoom;

        setCanvasZoom(newZoom);

        // Adjust scroll to keep the point under the cursor
        const designArea = this;
        designArea.scrollLeft += mouseCanvasX * (newZoom - oldZoom);
        designArea.scrollTop += mouseCanvasY * (newZoom - oldZoom);
    }, { passive: false });

    // Handle window resize to show/hide sidebar appropriately
    window.addEventListener('resize', function() {
        const sidebar = document.getElementById('sidebar');
        const toggleButton = document.querySelector('.mobile-sidebar-toggle');

        if (window.innerWidth > 768) {
            // Desktop - always show sidebar
            sidebar.classList.remove('mobile-open');
            sidebar.style.display = '';
            if (toggleButton) {
                toggleButton.innerHTML = '<i class="fas fa-cog"></i> Tools';
            }
        } else if (window.innerWidth <= 768 && !sidebar.classList.contains('mobile-open')) {
            // Mobile and sidebar not open - hide it
            sidebar.style.display = 'none';
        }
    });
});

function checkLibrariesLoaded() {
    const missingLibraries = [];

    // Check QRious
    if (typeof QRious === 'undefined') {
        missingLibraries.push('QRious (QR Code generation)');
    }

    // Check JsBarcode
    if (typeof JsBarcode === 'undefined') {
        missingLibraries.push('JsBarcode (Barcode generation)');
    }

    // Check JSZip
    if (typeof JSZip === 'undefined') {
        missingLibraries.push('JSZip (PNG export)');
    }

    if (missingLibraries.length > 0) {
        setTimeout(() => {
            showToast('warning', 'Libraries Not Loaded',
                `Some features may not work: ${missingLibraries.join(', ')}. Check your internet connection.`, 8000);
        }, 1000);
    }
}