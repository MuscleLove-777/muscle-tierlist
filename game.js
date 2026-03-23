/**
 * Muscle Tier List - MuscleLove
 * Pure HTML/CSS/JS drag & drop tier list
 */
(function () {
    'use strict';

    const IMAGE_COUNT = 10;
    const TIERS = ['S', 'A', 'B', 'C', 'D'];

    // State
    let draggedItem = null;
    let touchDragData = null; // { element, ghost, startX, startY }

    // ===== INITIALIZATION =====
    function init() {
        createImageItems();
        setupDragAndDrop();
        setupButtons();
    }

    function createImageItems() {
        const pool = document.getElementById('unrankedPool');
        for (let i = 1; i <= IMAGE_COUNT; i++) {
            const item = createItem(i);
            pool.appendChild(item);
        }
    }

    function createItem(index) {
        const div = document.createElement('div');
        div.className = 'tier-item';
        div.draggable = true;
        div.dataset.img = `img${index}`;

        const img = document.createElement('img');
        img.src = `images/img${index}.png`;
        img.alt = `Muscle ${index}`;
        img.loading = 'lazy';
        div.appendChild(img);

        return div;
    }

    // ===== MOUSE DRAG & DROP =====
    function setupDragAndDrop() {
        // All tier-items containers + unranked pool are drop targets
        const dropZones = [
            ...document.querySelectorAll('.tier-items'),
            document.getElementById('unrankedPool')
        ];

        // Delegate dragstart on body
        document.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.tier-item');
            if (!item) return;
            draggedItem = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            // Set a transparent drag image on some browsers
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                e.dataTransfer.setDragImage(canvas, 0, 0);
            } catch (_) {}
        });

        document.addEventListener('dragend', (e) => {
            if (draggedItem) {
                draggedItem.classList.remove('dragging');
                draggedItem = null;
            }
            clearAllHighlights();
            removeDropIndicators();
        });

        dropZones.forEach((zone) => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const row = zone.closest('.tier-row');
                if (row) row.classList.add('drag-over');
                if (zone.id === 'unrankedPool') zone.classList.add('drag-over');
                showDropIndicator(zone, e.clientX, e.clientY);
            });

            zone.addEventListener('dragleave', (e) => {
                // Only remove highlight if actually leaving the zone
                if (!zone.contains(e.relatedTarget)) {
                    const row = zone.closest('.tier-row');
                    if (row) row.classList.remove('drag-over');
                    if (zone.id === 'unrankedPool') zone.classList.remove('drag-over');
                    removeDropIndicators(zone);
                }
            });

            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                if (!draggedItem) return;
                insertAtPosition(zone, draggedItem, e.clientX, e.clientY);
                clearAllHighlights();
                removeDropIndicators();
            });
        });

        // ===== TOUCH SUPPORT =====
        document.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: false });
    }

    // ===== TOUCH HANDLERS =====
    function handleTouchStart(e) {
        const item = e.target.closest('.tier-item');
        if (!item) return;

        const touch = e.touches[0];
        touchDragData = {
            element: item,
            ghost: null,
            startX: touch.clientX,
            startY: touch.clientY,
            started: false
        };
    }

    function handleTouchMove(e) {
        if (!touchDragData) return;

        const touch = e.touches[0];
        const dx = touch.clientX - touchDragData.startX;
        const dy = touch.clientY - touchDragData.startY;

        // Start drag after small movement threshold
        if (!touchDragData.started && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
            touchDragData.started = true;
            touchDragData.element.classList.add('dragging');
            draggedItem = touchDragData.element;

            // Create ghost
            const ghost = document.createElement('div');
            ghost.className = 'drag-ghost';
            const img = document.createElement('img');
            img.src = touchDragData.element.querySelector('img').src;
            ghost.appendChild(img);
            document.body.appendChild(ghost);
            touchDragData.ghost = ghost;
        }

        if (!touchDragData.started) return;
        e.preventDefault();

        // Move ghost
        touchDragData.ghost.style.left = touch.clientX + 'px';
        touchDragData.ghost.style.top = touch.clientY + 'px';

        // Highlight drop zone
        clearAllHighlights();
        removeDropIndicators();
        const zone = getDropZoneAt(touch.clientX, touch.clientY);
        if (zone) {
            const row = zone.closest('.tier-row');
            if (row) row.classList.add('drag-over');
            if (zone.id === 'unrankedPool') zone.classList.add('drag-over');
            showDropIndicator(zone, touch.clientX, touch.clientY);
        }
    }

    function handleTouchEnd(e) {
        if (!touchDragData) return;

        if (touchDragData.started) {
            // Find drop zone
            const ghost = touchDragData.ghost;
            const x = parseInt(ghost.style.left);
            const y = parseInt(ghost.style.top);
            const zone = getDropZoneAt(x, y);

            if (zone) {
                insertAtPosition(zone, touchDragData.element, x, y);
            }

            // Cleanup
            touchDragData.element.classList.remove('dragging');
            ghost.remove();
            clearAllHighlights();
            removeDropIndicators();
            draggedItem = null;
        }

        touchDragData = null;
    }

    // ===== DROP ZONE DETECTION =====
    function getDropZoneAt(x, y) {
        const zones = [
            ...document.querySelectorAll('.tier-items'),
            document.getElementById('unrankedPool')
        ];

        for (const zone of zones) {
            const rect = zone.getBoundingClientRect();
            // Expand hit area vertically to whole tier row
            const row = zone.closest('.tier-row');
            const useRect = row ? row.getBoundingClientRect() : rect;

            if (x >= useRect.left && x <= useRect.right &&
                y >= useRect.top && y <= useRect.bottom) {
                return zone;
            }
        }
        return null;
    }

    // ===== INSERT AT POSITION =====
    function insertAtPosition(zone, item, clientX, clientY) {
        const items = [...zone.querySelectorAll('.tier-item')].filter(el => el !== item);

        if (items.length === 0) {
            zone.appendChild(item);
            return;
        }

        // Find the correct insertion point
        let insertBefore = null;
        for (const child of items) {
            const rect = child.getBoundingClientRect();
            const midX = rect.left + rect.width / 2;
            if (clientX < midX) {
                insertBefore = child;
                break;
            }
        }

        if (insertBefore) {
            zone.insertBefore(item, insertBefore);
        } else {
            zone.appendChild(item);
        }
    }

    // ===== DROP INDICATOR =====
    function showDropIndicator(zone, clientX, clientY) {
        removeDropIndicators(zone);
        const items = [...zone.querySelectorAll('.tier-item')].filter(el => el !== draggedItem);

        if (items.length === 0) return;

        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator';

        let insertBefore = null;
        for (const child of items) {
            const rect = child.getBoundingClientRect();
            if (clientX < rect.left + rect.width / 2) {
                insertBefore = child;
                break;
            }
        }

        if (insertBefore) {
            zone.insertBefore(indicator, insertBefore);
        } else {
            zone.appendChild(indicator);
        }
    }

    function removeDropIndicators(zone) {
        const scope = zone || document;
        scope.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    }

    // ===== HIGHLIGHTS =====
    function clearAllHighlights() {
        document.querySelectorAll('.tier-row.drag-over').forEach(el => el.classList.remove('drag-over'));
        const pool = document.getElementById('unrankedPool');
        if (pool) pool.classList.remove('drag-over');
    }

    // ===== BUTTONS =====
    function setupButtons() {
        document.getElementById('btnReset').addEventListener('click', resetTierList);
        document.getElementById('btnShare').addEventListener('click', shareOnX);
    }

    function resetTierList() {
        const pool = document.getElementById('unrankedPool');
        // Collect all items from tiers
        document.querySelectorAll('.tier-items .tier-item').forEach(item => {
            pool.appendChild(item);
        });
        // Sort by img number
        const items = [...pool.querySelectorAll('.tier-item')];
        items.sort((a, b) => {
            const numA = parseInt(a.dataset.img.replace('img', ''));
            const numB = parseInt(b.dataset.img.replace('img', ''));
            return numA - numB;
        });
        items.forEach(item => pool.appendChild(item));
    }

    function shareOnX() {
        const tierData = {};
        let hasAny = false;

        TIERS.forEach(tier => {
            const zone = document.querySelector(`.tier-items[data-tier="${tier}"]`);
            const items = [...zone.querySelectorAll('.tier-item')];
            if (items.length > 0) {
                hasAny = true;
                tierData[tier] = items.map(el => el.dataset.img);
            }
        });

        if (!hasAny) {
            // Nothing ranked yet
            alert('まずは画像をティアに入れてね！\nDrag images into tiers first!');
            return;
        }

        let text = '【俺のMuscleLoveティアリスト】\n';
        const parts = [];
        TIERS.forEach(tier => {
            if (tierData[tier]) {
                parts.push(`${tier}: ${tierData[tier].join(',')}`);
            }
        });
        text += parts.join(' / ');
        text += '\n💪 #MuscleLove #筋肉ティアリスト';
        text += '\nhttps://www.patreon.com/cw/MuscleLove';

        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    // ===== START =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
