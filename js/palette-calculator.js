// Palette Loading Calculator
class PaletteCalculator {
    constructor() {
        this.palettes = [];
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.truckGroup = null;
        
        // Truck dimensions in inches
        this.TRUCK_LENGTH = 624; // 52 feet
        this.TRUCK_WIDTH = 102;  // 8.5 feet
        this.TRUCK_HEIGHT = 108; // 9 feet
        
        this.initializeEventListeners();
        this.updateSummary();
    }

    initializeEventListeners() {
        // Dimension type toggle
        const dimensionRadios = document.querySelectorAll('input[name="dimension-type"]');
        dimensionRadios.forEach(radio => {
            radio.addEventListener('change', this.toggleDimensionInputs.bind(this));
        });

        // Add palette button
        document.getElementById('add-palette').addEventListener('click', this.addPalette.bind(this));

        // Calculate loading button
        document.getElementById('calculate-loading').addEventListener('click', this.calculateOptimalLoading.bind(this));

        // 3D view controls
        document.getElementById('reset-view').addEventListener('click', this.resetView.bind(this));
        document.getElementById('top-view').addEventListener('click', this.topView.bind(this));
        document.getElementById('side-view').addEventListener('click', this.sideView.bind(this));
    }

    toggleDimensionInputs() {
        const standardDims = document.getElementById('standard-dims');
        const customDims = document.getElementById('custom-dims');
        const isStandard = document.querySelector('input[name="dimension-type"]:checked').value === 'standard';
        
        if (isStandard) {
            standardDims.style.display = 'block';
            customDims.style.display = 'none';
        } else {
            standardDims.style.display = 'none';
            customDims.style.display = 'block';
        }
    }

    getDimensions() {
        const isStandard = document.querySelector('input[name="dimension-type"]:checked').value === 'standard';
        
        if (isStandard) {
            const standardSize = document.getElementById('standard-size').value;
            const [width, depth, height] = standardSize.split('x').map(d => parseInt(d));
            return { width, depth, height };
        } else {
            return {
                width: parseInt(document.getElementById('width').value) || 0,
                depth: parseInt(document.getElementById('depth').value) || 0,
                height: parseInt(document.getElementById('height').value) || 0
            };
        }
    }

    addPalette() {
        const name = document.getElementById('palette-name').value.trim();
        const dimensions = this.getDimensions();
        const stacking = document.querySelector('input[name="stacking"]:checked').value;
        const quantity = parseInt(document.getElementById('quantity').value) || 1;

        // Validation
        if (!name) {
            alert('Please enter a palette name');
            return;
        }

        if (dimensions.width <= 0 || dimensions.depth <= 0 || dimensions.height <= 0) {
            alert('Please enter valid dimensions');
            return;
        }

        if (dimensions.width > this.TRUCK_WIDTH) {
            alert(`Palette width (${dimensions.width}") exceeds truck width (${this.TRUCK_WIDTH}")`);
            return;
        }

        if (dimensions.height > this.TRUCK_HEIGHT) {
            alert(`Palette height (${dimensions.height}") exceeds truck height (${this.TRUCK_HEIGHT}")`);
            return;
        }

        // Add palettes (create multiple entries for quantity > 1)
        for (let i = 0; i < quantity; i++) {
            const palette = {
                id: Date.now() + i,
                name: quantity > 1 ? `${name} #${i + 1}` : name,
                width: dimensions.width,
                depth: dimensions.depth,
                height: dimensions.height,
                stacking: stacking,
                linearFeet: dimensions.depth / 12, // Convert inches to feet
                placed: false,
                position: null
            };
            this.palettes.push(palette);
        }

        this.updatePaletteList();
        this.updateSummary();
        this.clearForm();
    }

    removePalette(id) {
        this.palettes = this.palettes.filter(p => p.id !== id);
        this.updatePaletteList();
        this.updateSummary();
    }

    updatePaletteList() {
        const container = document.getElementById('palette-items');
        
        if (this.palettes.length === 0) {
            container.innerHTML = '<p class="empty-state">No palettes added yet</p>';
            return;
        }

        container.innerHTML = this.palettes.map(palette => `
            <div class="palette-item">
                <div class="palette-info">
                    <div class="palette-name">${palette.name}</div>
                    <div class="palette-details">
                        ${palette.width}" × ${palette.depth}" × ${palette.height}" | 
                        ${this.getStackingLabel(palette.stacking)} | 
                        ${palette.linearFeet.toFixed(1)} linear feet
                    </div>
                </div>
                <div class="palette-actions">
                    <button class="btn-remove" onclick="calculator.removePalette(${palette.id})">Remove</button>
                </div>
            </div>
        `).join('');
    }

    getStackingLabel(stacking) {
        switch (stacking) {
            case 'stackable': return 'Stackable';
            case 'bottom-only': return 'Bottom Only';
            case 'top-only': return 'Top Only';
            default: return 'Unknown';
        }
    }

    updateSummary() {
        const totalPalettes = this.palettes.length;
        
        document.getElementById('total-palettes').textContent = totalPalettes;
        document.getElementById('total-linear-feet').textContent = 'Calculate to see result';
        
        // Enable/disable calculate button
        const calculateButton = document.getElementById('calculate-loading');
        calculateButton.disabled = totalPalettes === 0;
    }

    clearForm() {
        document.getElementById('palette-name').value = '';
        document.getElementById('width').value = '';
        document.getElementById('depth').value = '';
        document.getElementById('height').value = '';
        document.getElementById('quantity').value = '1';
        document.querySelector('input[name="dimension-type"][value="standard"]').checked = true;
        document.querySelector('input[name="stacking"][value="stackable"]').checked = true;
        this.toggleDimensionInputs();
    }

    calculateOptimalLoading() {
        // Reset all palettes
        this.palettes.forEach(p => {
            p.placed = false;
            p.position = null;
        });

        const loadingPlan = this.optimizeLoading();
        this.displayResults(loadingPlan);
        this.create3DVisualization(loadingPlan);
    }

    optimizeLoading() {
        // Sort palettes by loading priority
        const sortedPalettes = [...this.palettes].sort((a, b) => {
            // Priority: 1) Bottom-only first (they need ground space), 2) Stackable second, 3) Top-only last, 4) Largest depth first
            if (a.stacking === 'bottom-only' && b.stacking !== 'bottom-only') return -1;
            if (b.stacking === 'bottom-only' && a.stacking !== 'bottom-only') return 1;
            if (a.stacking === 'stackable' && b.stacking === 'top-only') return -1;
            if (b.stacking === 'stackable' && a.stacking === 'top-only') return 1;
            return b.depth - a.depth; // Larger depth first
        });

        const loadingPlan = {
            layers: [],
            totalLinearFeet: 0,
            unplacedPalettes: [],
            efficiency: 0,
            occupiedSpaces: [] // Track occupied 3D spaces
        };

        for (const palette of sortedPalettes) {
            if (palette.placed) continue;

            const placement = this.findBestPlacement(palette, loadingPlan);
            
            if (placement) {
                palette.placed = true;
                palette.position = placement;
                console.log(`Placed ${palette.name} at layer ${placement.layer}, position (${placement.x}, ${placement.y}, ${placement.z})`);
                
                if (!loadingPlan.layers[placement.layer]) {
                    loadingPlan.layers[placement.layer] = [];
                }
                loadingPlan.layers[placement.layer].push(palette);
                
                // Track occupied space
                loadingPlan.occupiedSpaces.push({
                    x: placement.x,
                    y: placement.y,
                    z: placement.z,
                    width: palette.width,
                    depth: palette.depth,
                    height: palette.height
                });
            } else {
                loadingPlan.unplacedPalettes.push(palette);
            }
        }

        // Calculate total linear feet used (max X position + depth)
        let maxLinearFeet = 0;
        for (const palette of this.palettes) {
            if (palette.placed && palette.position) {
                maxLinearFeet = Math.max(maxLinearFeet, (palette.position.x + palette.depth) / 12);
            }
        }
        
        loadingPlan.totalLinearFeet = maxLinearFeet;
        loadingPlan.efficiency = (loadingPlan.totalLinearFeet / 52) * 100;

        return loadingPlan;
    }

    findBestPlacement(palette, loadingPlan) {
        // Check if palette fits in truck dimensions
        if (palette.width > this.TRUCK_WIDTH || palette.height > this.TRUCK_HEIGHT) {
            return null;
        }

        // For stackable palettes, try stacking first to minimize linear feet
        if (palette.stacking === 'stackable' || palette.stacking === 'top-only') {
            const stackPlacement = this.findStackPlacement(palette, loadingPlan);
            if (stackPlacement) {
                return stackPlacement;
            }
        }

        // Try ground level placement (for bottom-only and stackable that couldn't stack)
        if (palette.stacking !== 'top-only') {
            const groundPlacement = this.findGroundPlacement(palette, loadingPlan);
            if (groundPlacement) {
                return groundPlacement;
            }
        }

        return null; // Cannot place palette
    }
    
    findGroundPlacement(palette, loadingPlan) {
        // Calculate how many palettes can fit across the truck width
        const palettesAcrossWidth = Math.floor(this.TRUCK_WIDTH / palette.width);
        const totalWidthUsed = palettesAcrossWidth * palette.width;
        const widthOffset = (this.TRUCK_WIDTH - totalWidthUsed) / 2; // Center the palettes
        
        // Start from back of truck (x=0) and work forward
        for (let x = 0; x <= this.TRUCK_LENGTH - palette.depth; x += palette.depth) {
            // Try positions across the truck width (centered)
            for (let widthIndex = 0; widthIndex < palettesAcrossWidth; widthIndex++) {
                const z = -this.TRUCK_WIDTH/2 + widthOffset + (widthIndex * palette.width) + (palette.width/2);
                
                const position = {
                    x: x,
                    y: 0,
                    z: z,
                    layer: 0,
                    width: palette.width,
                    depth: palette.depth,
                    height: palette.height
                };
                
                if (!this.isSpaceOccupied(position, loadingPlan.occupiedSpaces)) {
                    console.log(`Ground placement found: x=${x}, z=${z}, palette: ${palette.width}x${palette.depth}`);
                    return position;
                }
            }
        }
        
        return null;
    }
    
    findStackPlacement(palette, loadingPlan) {
        // Look for suitable base palettes to stack on
        // Sort spaces by position to prioritize stacking towards the back
        const sortedSpaces = [...loadingPlan.occupiedSpaces].sort((a, b) => a.x - b.x);
        
        for (const space of sortedSpaces) {
            // Only consider ground-level spaces for stacking bases
            if (space.y > 2) continue; // Skip if not on truck bed
            
            // Find the palette at this position
            const basePalette = this.findPaletteAtPosition(space, loadingPlan);
            if (!basePalette || basePalette.stacking === 'top-only') {
                continue;
            }
            
            // Check if current palette fits on base palette (with some tolerance)
            if (palette.width <= space.width + 2 && palette.depth <= space.depth + 2) {
                const stackHeight = space.y + space.height; // Stack directly on top
                
                if (stackHeight + palette.height <= this.TRUCK_HEIGHT) {
                    const position = {
                        x: space.x,
                        y: stackHeight,
                        z: space.z,
                        layer: Math.floor(stackHeight / 48) + 1,
                        width: palette.width,
                        depth: palette.depth,
                        height: palette.height
                    };
                    
                    // Check if this exact position is already occupied
                    if (!this.isSpaceOccupied(position, loadingPlan.occupiedSpaces)) {
                        return position;
                    }
                }
            }
        }
        
        return null;
    }
    
    findPaletteAtPosition(space, loadingPlan) {
        // Find palette that occupies this exact space
        const tolerance = 1; // 1 inch tolerance
        
        for (const palette of this.palettes) {
            if (palette.placed && palette.position &&
                Math.abs(palette.position.x - space.x) < tolerance &&
                Math.abs(palette.position.y - space.y) < tolerance &&
                Math.abs(palette.position.z - space.z) < tolerance) {
                return palette;
            }
        }
        return null;
    }
    
    isSpaceOccupied(position, occupiedSpaces) {
        const tolerance = 0.5; // Smaller tolerance for better precision
        
        for (const space of occupiedSpaces) {
            // Calculate boundaries for both spaces
            const pos1 = {
                xMin: position.x,
                xMax: position.x + position.depth,
                yMin: position.y,
                yMax: position.y + position.height,
                zMin: position.z - position.width/2,
                zMax: position.z + position.width/2
            };
            
            const pos2 = {
                xMin: space.x,
                xMax: space.x + space.depth,
                yMin: space.y,
                yMax: space.y + space.height,
                zMin: space.z - space.width/2,
                zMax: space.z + space.width/2
            };
            
            // Check for 3D overlap with tolerance
            const xOverlap = !(pos1.xMax <= pos2.xMin + tolerance || pos2.xMax <= pos1.xMin + tolerance);
            const yOverlap = !(pos1.yMax <= pos2.yMin + tolerance || pos2.yMax <= pos1.yMin + tolerance);
            const zOverlap = !(pos1.zMax <= pos2.zMin + tolerance || pos2.zMax <= pos1.zMin + tolerance);
            
            if (xOverlap && yOverlap && zOverlap) {
                return true; // Space is occupied
            }
        }
        
        return false; // Space is free
    }

    canStackOn(palette, basePalette, loadingPlan, targetLayer) {
        // Check if palette dimensions fit on base palette
        if (palette.width > basePalette.width || palette.depth > basePalette.depth) {
            return false;
        }
        
        // Check if base palette can support stacking
        if (basePalette.stacking === 'top-only') {
            return false;
        }
        
        return true;
    }

    getStackHeightAtPosition(x, z, loadingPlan) {
        let maxHeight = 0;
        
        for (const space of loadingPlan.occupiedSpaces) {
            // Check if the position overlaps with this occupied space
            if (x >= space.x && x <= space.x + space.depth &&
                z >= space.z - space.width/2 && z <= space.z + space.width/2) {
                maxHeight = Math.max(maxHeight, space.y + space.height);
            }
        }
        
        return maxHeight;
    }
    
    positionsOverlap(pos1, pos2, palette1, palette2) {
        // Check if two palettes overlap in the X-Z plane
        const x1Min = pos1.x, x1Max = pos1.x + palette1.depth;
        const z1Min = pos1.z - palette1.width/2, z1Max = pos1.z + palette1.width/2;
        
        const x2Min = pos2.x, x2Max = pos2.x + palette2.depth;
        const z2Min = pos2.z - palette2.width/2, z2Max = pos2.z + palette2.width/2;
        
        return !(x1Max <= x2Min || x2Max <= x1Min || z1Max <= z2Min || z2Max <= z1Min);
    }

    displayResults(loadingPlan) {
        const resultsContainer = document.getElementById('loading-results');
        
        let html = '';
        
        // Summary
        const placedPalettes = this.palettes.filter(p => p.placed).length;
        const totalPalettes = this.palettes.length;
        
        if (placedPalettes === totalPalettes) {
            html += `
                <div class="result-summary">
                    <h4>All palettes successfully loaded!</h4>
                    <div class="result-stats">
                        <div class="stat-item">
                            <span class="stat-value">${loadingPlan.totalLinearFeet.toFixed(1)} ft</span>
                            <span class="stat-label">Linear Feet Used</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${loadingPlan.efficiency.toFixed(1)}%</span>
                            <span class="stat-label">Truck Efficiency</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="warning-message">
                    <h4>Some palettes could not be loaded</h4>
                    <p>${placedPalettes} of ${totalPalettes} palettes placed. ${loadingPlan.unplacedPalettes.length} palettes couldn't fit.</p>
                </div>
                <div class="result-summary">
                    <div class="result-stats">
                        <div class="stat-item">
                            <span class="stat-value">${loadingPlan.totalLinearFeet.toFixed(1)} ft</span>
                            <span class="stat-label">Linear Feet Used</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${loadingPlan.efficiency.toFixed(1)}%</span>
                            <span class="stat-label">Truck Efficiency</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Shipping recommendation
        if (loadingPlan.totalLinearFeet <= 26) {
            html += `
                <div class="result-summary" style="border-color: #48bb78;">
                    <h4>Recommendation: Partial Truckload (PTL)</h4>
                    <p>Your shipment uses ${loadingPlan.totalLinearFeet.toFixed(1)} linear feet, which qualifies for partial truckload shipping. This can save costs by sharing space with other shipments.</p>
                </div>
            `;
        } else {
            html += `
                <div class="warning-message">
                    <h4>Recommendation: Full Truckload (FTL)</h4>
                    <p>Your shipment uses ${loadingPlan.totalLinearFeet.toFixed(1)} linear feet, which exceeds the 26-foot PTL limit. You'll need a full truckload shipment.</p>
                </div>
            `;
        }

        resultsContainer.innerHTML = html;
    }

    create3DVisualization(loadingPlan) {
        const container = document.getElementById('truck-visualization');
        container.innerHTML = ''; // Clear previous visualization

        // Check if container has dimensions
        if (container.clientWidth === 0 || container.clientHeight === 0) {
            console.warn('Container has no dimensions, retrying...');
            setTimeout(() => this.create3DVisualization(loadingPlan), 100);
            return;
        }

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // Sky blue background

        // Create camera with better positioning
        this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 1, 5000);
        this.camera.position.set(400, 300, 600);
        this.camera.lookAt(312, 54, 0); // Look at center of truck

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x87ceeb, 1);
        container.appendChild(this.renderer.domElement);

        // Create controls (check if OrbitControls is available)
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.target.set(312, 54, 0); // Center of truck
            this.controls.enableZoom = true;
            this.controls.enablePan = true;
            this.controls.enableRotate = true;
            this.controls.autoRotate = false;
            console.log('OrbitControls initialized successfully');
        } else {
            console.error('OrbitControls not loaded! Check the CDN link.');
        }

        // Create truck group
        this.truckGroup = new THREE.Group();
        this.scene.add(this.truckGroup);

        // Add lighting first
        this.addLighting();

        // Create truck outline
        this.createTruckOutline();

        // Add placed palettes
        this.addPalettesToScene(loadingPlan);

        // Initial render
        this.renderer.render(this.scene, this.camera);

        // Start render loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
    }

    createTruckOutline() {
        // Truck bed (floor)
        const bedGeometry = new THREE.BoxGeometry(this.TRUCK_LENGTH, 2, this.TRUCK_WIDTH);
        const bedMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x8b4513 // Brown color for truck bed
        });
        const truckBed = new THREE.Mesh(bedGeometry, bedMaterial);
        truckBed.position.set(this.TRUCK_LENGTH/2, 1, 0);
        truckBed.receiveShadow = true;
        this.truckGroup.add(truckBed);

        // Truck walls (wireframe outline)
        const wallsGeometry = new THREE.BoxGeometry(this.TRUCK_LENGTH, this.TRUCK_HEIGHT, this.TRUCK_WIDTH);
        const wallsEdges = new THREE.EdgesGeometry(wallsGeometry);
        const wallsMaterial = new THREE.LineBasicMaterial({ 
            color: 0x333333,
            linewidth: 2
        });
        const wallsWireframe = new THREE.LineSegments(wallsEdges, wallsMaterial);
        wallsWireframe.position.set(this.TRUCK_LENGTH/2, this.TRUCK_HEIGHT/2 + 2, 0);
        this.truckGroup.add(wallsWireframe);


    }

    addLighting() {
        // Ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
        this.scene.add(ambientLight);

        // Main directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(800, 600, 400);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 2000;
        directionalLight.shadow.camera.left = -1000;
        directionalLight.shadow.camera.right = 1000;
        directionalLight.shadow.camera.top = 1000;
        directionalLight.shadow.camera.bottom = -1000;
        this.scene.add(directionalLight);

        // Additional point light for better visibility
        const pointLight = new THREE.PointLight(0xffffff, 0.5, 1000);
        pointLight.position.set(this.TRUCK_LENGTH/2, 200, this.TRUCK_WIDTH/2);
        this.scene.add(pointLight);
    }

    addPalettesToScene(loadingPlan) {
        const colors = [
            0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xf9ca24, 0xf0932b,
            0xeb4d4b, 0x6ab04c, 0x9c88ff, 0xfda7df, 0x9b59b6
        ];

        let colorIndex = 0;

        for (const palette of this.palettes) {
            if (!palette.placed || !palette.position) continue;

            const geometry = new THREE.BoxGeometry(palette.depth, palette.height, palette.width);
            const material = new THREE.MeshLambertMaterial({ 
                color: colors[colorIndex % colors.length],
                transparent: false,
                opacity: 1.0
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            // Position the palette (adjust for truck bed height)
            // Note: Three.js positions objects by their center, so we need to offset by half dimensions
            const finalX = palette.position.x + palette.depth/2;
            const finalY = palette.position.y + palette.height/2 + 2;
            const finalZ = palette.position.z;
            
            console.log(`3D positioning ${palette.name}: logical(${palette.position.x}, ${palette.position.y}, ${palette.position.z}) -> 3D(${finalX}, ${finalY}, ${finalZ})`);
            
            mesh.position.set(finalX, finalY, finalZ);

            // Add edges for better visibility
            const edges = new THREE.EdgesGeometry(geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({ 
                color: 0x000000,
                linewidth: 1
            });
            const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
            mesh.add(edgeLines);

            this.truckGroup.add(mesh);
            colorIndex++;
        }
        
        console.log(`Added ${colorIndex} palettes to 3D scene`);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        if (this.controls) {
            this.controls.update();
        }
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        
        const container = document.getElementById('truck-visualization');
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    resetView() {
        if (!this.camera) return;
        this.camera.position.set(400, 300, 600);
        this.camera.lookAt(312, 54, 0);
        if (this.controls) {
            this.controls.target.set(312, 54, 0);
            this.controls.update();
        }
    }

    topView() {
        if (!this.camera) return;
        this.camera.position.set(this.TRUCK_LENGTH/2, 800, 0);
        this.camera.lookAt(this.TRUCK_LENGTH/2, 0, 0);
        if (this.controls) {
            this.controls.target.set(this.TRUCK_LENGTH/2, 0, 0);
            this.controls.update();
        }
    }

    sideView() {
        if (!this.camera) return;
        this.camera.position.set(this.TRUCK_LENGTH/2, this.TRUCK_HEIGHT/2, 800);
        this.camera.lookAt(this.TRUCK_LENGTH/2, 0, 0);
        if (this.controls) {
            this.controls.target.set(this.TRUCK_LENGTH/2, this.TRUCK_HEIGHT/2, 0);
            this.controls.update();
        }
    }
}

// Initialize the calculator when the page loads
let calculator;
document.addEventListener('DOMContentLoaded', function() {
    calculator = new PaletteCalculator();
});
