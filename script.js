console.log("Logic Synthesizer Engine V6: Bulletproof Loading");
console.log("Advanced Logic Synthesizer Engine V5: Loaded");

document.addEventListener('DOMContentLoaded', () => {
    // Tab switching logic
    // 1. UI Setup: Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            e.target.classList.add('active');
            document.getElementById(e.target.dataset.target).classList.add('active');
            document.getElementById('outputs').style.display = 'none';
        });
    });

    // Truth Table Input Generator
    const btnGenerate = document.getElementById('btnGenerateTTInputs');
    if (btnGenerate) {
        btnGenerate.addEventListener('click', () => {
            const varsStr = document.getElementById('inputVarsTT').value;
            const vars = [...new Set(varsStr.toUpperCase().match(/[A-Z]/g) || [])].sort();
            if (vars.length === 0 || vars.length > 6) {
                alert("Please enter between 1 and 6 valid variables (A-Z).");
                return;
            }
            
            let html = '<table><thead><tr>';
            vars.forEach(v => html += `<th>${v}</th>`);
            html += '<th>Output</th></tr></thead><tbody>';
            
            const rows = Math.pow(2, vars.length);
            for(let i=0; i<rows; i++) {
                html += '<tr>';
                for(let j=0; j<vars.length; j++) {
                    let val = (i & (1 << (vars.length - 1 - j))) ? 1 : 0;
                    html += `<td>${val}</td>`;
                }
                html += `<td><select id="tt-out-${i}"><option value="0">0</option><option value="1">1</option><option value="X">X</option></select></td></tr>`;
            }
            html += '</tbody></table>';
            document.getElementById('ttInputContainer').innerHTML = html;
            document.getElementById('ttInputContainer').dataset.vars = vars.join(',');
    // Min/Max Radio Toggle UX
    document.querySelectorAll('input[name="termType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('lblTerms').innerText = 
                e.target.value === 'minterms' ? 'Minterms (comma separated integers):' : 'Maxterms (comma separated integers):';
        });
    }
    });

    // Main Synthesize Button
    const btnSynthesize = document.getElementById('btnSynthesize');
    if (btnSynthesize) {
        btnSynthesize.addEventListener('click', processInput);
    } else {
        console.error("CRITICAL ERROR: Synthesize button not found in HTML!");
    }
    // Truth Table Generator
    document.getElementById('btnGenerateTTInputs').addEventListener('click', () => {
        const varsStr = document.getElementById('inputVarsTT').value;
        const vars = [...new Set(varsStr.toUpperCase().match(/[A-Z]/g) || [])].sort();
        if (vars.length === 0 || vars.length > 6) {
            alert("Please enter between 1 and 6 valid variables (A-Z).");
            return;
        }
        
        let html = '<div class="tt-container"><table><thead><tr>';
        vars.forEach(v => html += `<th>${v}</th>`);
        html += '<th>Output</th></tr></thead><tbody>';
        
        const rows = Math.pow(2, vars.length);
        for(let i=0; i<rows; i++) {
            html += '<tr>';
            for(let j=0; j<vars.length; j++) {
                let val = (i & (1 << (vars.length - 1 - j))) ? 1 : 0;
                html += `<td>${val}</td>`;
            }
            html += `<td><select id="tt-out-${i}">
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="X">X</option>
            </select></td></tr>`;
        }
        html += '</tbody></table></div>';
        
        const container = document.getElementById('ttInputContainer');
        container.innerHTML = html;
        container.dataset.vars = vars.join(',');
        document.getElementById('btnSynthesizeTT').style.display = 'block';
    });

    // 2. Synthesize Action Bindings
    document.querySelectorAll('.synthesize-btn').forEach(btn => {
        btn.addEventListener('click', processInput);
    });

    // 3. Scroll to Top Behavior
    const scrollTopBtn = document.getElementById("scrollTopBtn");
    window.onscroll = () => { scrollTopBtn.style.display = window.scrollY > 300 ? "block" : "none"; };
    scrollTopBtn.onclick = () => { window.scrollTo({top: 0, behavior: 'smooth'}); };
});


// ==========================================
// CORE PIPELINE: INPUT PARSING
// ==========================================
function processInput() {
    const errorMsg = document.getElementById('errorMsg');
    const outputs = document.getElementById('outputs');
    errorMsg.innerText = '';
    outputs.innerHTML = '';
    outputs.style.display = 'none';

    try {
        const activeTab = document.querySelector('.tab.active').dataset.target;
        let vars = [];
        let tt = [];
        let synthesisQueue = []; // Supports multi-output (e.g. Adders)

        if (activeTab === 'tab-expr') {
            const expr = document.getElementById('inputExpr').value;
            const exprDC = document.getElementById('inputExprDC').value;
            if(!expr.trim()) throw new Error("Expression cannot be empty.");

            let cleanExpr = expr.toUpperCase().replace(/(AND|OR|NOT|NAND|NOR|XOR|XNOR)/g, '');
            vars = [...new Set(cleanExpr.match(/[A-Z]/g) || [])].sort();
            
            let allVars = (expr + " " + exprDC).toUpperCase().match(/[A-Z]/g) || [];
            const vars = [...new Set(allVars)].sort();
            if(vars.length > 6) throw new Error("Maximum 6 variables supported.");
            if(vars.length === 0) throw new Error("No valid variables found.");

            let tt = [];
            const rows = Math.pow(2, vars.length);
            for (let i = 0; i < rows; i++) {
                let inputVals = {};
                for (let j = 0; j < vars.length; j++) {
                    inputVals[vars[j]] = (i & (1 << (vars.length - 1 - j))) ? 1 : 0;
                }
                tt.push(evaluateExpression(expr, inputVals));
                
                let isDC = exprDC.trim() ? evaluateExpression(exprDC, inputVals) : 0;
                if (isDC) {
                    tt.push('X');
                } else {
                    tt.push(evaluateExpression(expr, inputVals));
                }
            }
            synthesisQueue.push({ name: 'Boolean Function', vars: vars, tt: tt });
        } 
        else if (activeTab === 'tab-minterms') {
        else if (activeTab === 'tab-minmax') {
            const varsStr = document.getElementById('inputVarsMin').value;
            vars = [...new Set(varsStr.toUpperCase().match(/[A-Z]/g) || [])].sort();
            const vars = [...new Set(varsStr.toUpperCase().match(/[A-Z]/g) || [])].sort();
            if(vars.length === 0 || vars.length > 6) throw new Error("Enter 1-6 valid variables.");

            const minterms = document.getElementById('inputMinterms').value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
            
            const dontCaresStr = document.getElementById('inputDontCares') ? document.getElementById('inputDontCares').value : '';
            const dontCares = dontCaresStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
            const isMinterm = document.querySelector('input[name="termType"]:checked').value === 'minterms';
            const terms = document.getElementById('inputTerms').value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
            const dontCares = document.getElementById('inputDontCares').value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));

            let tt = [];
            const rows = Math.pow(2, vars.length);
            for (let i = 0; i < rows; i++) {
                if (minterms.includes(i)) tt.push(1);
                else if (dontCares.includes(i)) tt.push('X');
                else tt.push(0);
                if (dontCares.includes(i)) tt.push('X');
                else if (terms.includes(i)) tt.push(isMinterm ? 1 : 0);
                else tt.push(isMinterm ? 0 : 1);
            }
            synthesisQueue.push({ name: 'Boolean Function', vars: vars, tt: tt });
        }
        else if (activeTab === 'tab-tt') {
            const container = document.getElementById('ttInputContainer');
            if(!container.dataset.vars) throw new Error("Generate the Truth Table inputs first.");
            vars = container.dataset.vars.split(',');
            if(!container.dataset.vars) throw new Error("Generate Truth Table first.");
            const vars = container.dataset.vars.split(',');
            let tt = [];
            const rows = Math.pow(2, vars.length);
            for (let i = 0; i < rows; i++) {
                let val = document.getElementById(`tt-out-${i}`).value;
                tt.push(val === 'X' ? 'X' : parseInt(val));
            }
            synthesisQueue.push({ name: 'Boolean Function', vars: vars, tt: tt });
        }
        else if (activeTab === 'tab-arithmetic') {
            const type = document.getElementById('selectArithmetic').value;
            synthesisQueue = getArithmeticConfig(type);
            outputs.appendChild(renderBlockDiagram(type));
        }

        runSynthesis(vars, tt);
        // Process all gathered functions in the queue
        synthesisQueue.forEach(job => {
            const section = document.createElement('div');
            section.className = 'multi-output-section';
            section.innerHTML = `<h2 class="output-header">Synthesizing: ${job.name}</h2>`;
            section.innerHTML += runSynthesis(job.vars, job.tt);
            outputs.appendChild(section);
        });

        outputs.style.display = 'block';

    } catch (e) {
        errorMsg.innerText = e.message;
    }
}

// Evaluator capable of handling NOT(~,!), AND(&,*), OR(|,+), XOR(^)
function evaluateExpression(expr, inputs) {
    let norm = expr.toUpperCase();
    norm = norm.replace(/XOR/g, '^').replace(/AND/g, '&').replace(/OR/g, '|').replace(/NOT/g, '~');
    norm = norm.replace(/\s+/g, '').replace(/\*/g, '&').replace(/\+/g, '|').replace(/!/g, '~');
    norm = norm.replace(/([A-Z])'/g, '~$1');
    let norm = expr.toUpperCase().replace(/\s+/g, '')
                   .replace(/AND/g, '&').replace(/OR/g, '|').replace(/NOT/g, '~').replace(/XOR/g, '^')
                   .replace(/\*/g, '&').replace(/\+/g, '|').replace(/!/g, '~');
    
    // Implicit ANDs (e.g. AB -> A&B, A(B) -> A&(B))
    norm = norm.replace(/([A-Z\)])(?=[A-Z\(~])/g, '$1&');

    
    Object.keys(inputs).forEach(v => {
        let regex = new RegExp(v, 'g');
        norm = norm.replace(regex, inputs[v]);
        norm = norm.replace(new RegExp(v, 'g'), inputs[v]);
    });

    
    // Convert to JS: ^ to !==, & to &&, | to ||
    let jsExpr = norm.replace(/&/g, '&&').replace(/\|/g, '||').replace(/~/g, '!');

    // Handle XOR strictly manually by replacing A ^ B with A !== B
    // Simple RegEx won't fix nested XOR properly in JS without AST, but for binary strings:
    jsExpr = jsExpr.replace(/([01!&|()]+)\^([01!&|()]+)/g, '!!($1) !== !!($2)'); 

    try {
        const fn = new Function(`return !!(${jsExpr});`);
        return fn() ? 1 : 0;
        return (new Function(`return !!(${jsExpr});`))() ? 1 : 0;
    } catch(e) {
        throw new Error("Invalid Boolean Expression. Please check your syntax.");
        throw new Error(`Invalid Boolean Expression context: ${expr}`);
    }
}

function quineMcCluskey(minterms, dontCares, numVars) {
    if (minterms.length === 0) return [];
    
    let allTerms = [...new Set([...minterms, ...dontCares])];

// ==========================================
// QUINE-MCCLUSKEY ALGORITHM (WITH DON'T CARES)
// ==========================================
function quineMcCluskey(targets, dontCares, numVars) {
    if (targets.length === 0) return [];
    let allTerms = [...new Set([...targets, ...dontCares])];
    if (allTerms.length === Math.pow(2, numVars)) return ['1'];

    let groups = Array.from({length: numVars + 1}, () => []);
@@ -191,10 +241,11 @@ function quineMcCluskey(minterms, dontCares, numVars) {
        groups = nextGroups;
    }

    let uncovered = new Set(minterms); 
    // Uncovered targets (Ignore Don't Cares for coverage)
    let uncovered = new Set(targets);
    let essential = [];

    minterms.forEach(m => {
    targets.forEach(m => {
        let covers = primeImplicants.filter(pi => pi.minterms.includes(m));
        if (covers.length === 1) {
            let epi = covers[0];
@@ -213,13 +264,16 @@ function quineMcCluskey(minterms, dontCares, numVars) {
            let coverCount = pi.minterms.filter(m => uncovered.has(m)).length;
            if (coverCount > maxCover) { maxCover = coverCount; bestPI = pi; }
        });
        if (!bestPI) break; // Defensive guard to prevent infinite loops
        solution.push(bestPI);
        bestPI.minterms.forEach(m => uncovered.delete(m));
    }
    
    return solution.map(pi => pi.bits);
}

// ==========================================
// SYNTHESIS PIPELINE & AST
// ==========================================
function runSynthesis(vars, tt) {
    const minterms1 = tt.map((v, i) => v === 1 ? i : -1).filter(i => i !== -1);
    const minterms0 = tt.map((v, i) => v === 0 ? i : -1).filter(i => i !== -1);
@@ -231,30 +285,56 @@ function runSynthesis(vars, tt) {
    const sopTerms = qmSOP.map(bits => bitsToLiterals(bits, vars, true));
    const posTerms = qmPOS.map(bits => bitsToLiterals(bits, vars, false));

    document.getElementById('outSOP').innerText = formatEquation(sopTerms, false);
    document.getElementById('outPOS').innerText = formatEquation(posTerms, true);
    const sopEq = formatEquation(sopTerms, false);
    const posEq = formatEquation(posTerms, true);

    renderTruthTable(vars, tt);
    const ttHtml = generateTruthTableHTML(vars, tt);

    // Build Strict 2-Input ASTs
    const astStandard = buildStandardAST(sopTerms);
    const astStandardPOS = buildPOSStandardAST(posTerms);

    // Universal gates conversion
    const astNAND = convertToNAND(astStandard);
    const astNOR = convertToNOR(astStandardPOS);

    // Verification (Ignores X)
    const verified = verifyASTs(vars, tt, astStandard, astNAND, astNOR);
    const msgBox = document.getElementById('verificationMsg');
    if (verified) {
        msgBox.className = 'verification success';
        msgBox.innerText = '✓ Verification Passed: Simplified, NAND-only, and NOR-only circuits perfectly match the original truth table.';
    } else {
        msgBox.className = 'verification fail';
        msgBox.innerText = '✗ Verification Failed: Circuit outputs do not match the original truth table.';
    }

    document.getElementById('svgStandard').innerHTML = renderAST(astStandard);
    document.getElementById('svgNAND').innerHTML = renderAST(astNAND);
    document.getElementById('svgNOR').innerHTML = renderAST(astNOR);
    const veriClass = verified ? 'success' : 'fail';
    const veriText = verified ? '✓ Verification Passed: Simplified, NAND-only, and NOR-only circuits all perfectly match the original truth table.' 
                              : '✗ Verification Failed: Circuit outputs mismatch.';

    const idHash = Math.random().toString(36).substring(7); // unique IDs for multi-render

    let html = `
        <div class="verification ${veriClass}">${veriText}</div>
        <div class="grid-2">
            <div class="result-box">
                <h3>Minimized Expressions</h3>
                <p><strong>SOP (Sum of Products):</strong> <span class="code-font">${sopEq}</span></p>
                <p><strong>POS (Product of Sums):</strong> <span class="code-font">${posEq}</span></p>
            </div>
            <div class="result-box">
                <h3>Truth Table</h3>
                ${ttHtml}
            </div>
        </div>
        
        <h3>Logic Circuits</h3>
        <div class="circuit-box">
            <h4>Standard Circuit (AND, OR, NOT)</h4>
            <div class="svg-container">${renderAST(astStandard)}</div>
        </div>
        <div class="circuit-box">
            <h4>NAND-Only Circuit</h4>
            <div class="svg-container">${renderAST(astNAND)}</div>
        </div>
        <div class="circuit-box">
            <h4>NOR-Only Circuit</h4>
            <div class="svg-container">${renderAST(astNOR)}</div>
        </div>
    `;
    return html;
}

function bitsToLiterals(bits, vars, isSOP) {
@@ -280,8 +360,8 @@ function formatEquation(terms, isPOS) {
    return strings.join(outerJoin);
}

function renderTruthTable(vars, tt) {
    let html = '<table><thead><tr>';
function generateTruthTableHTML(vars, tt) {
    let html = '<div class="tt-container"><table><thead><tr>';
    vars.forEach(v => html += `<th>${v}</th>`);
    html += '<th>Output</th></tr></thead><tbody>';

@@ -294,10 +374,14 @@ function renderTruthTable(vars, tt) {
        let ttClass = tt[i] === 'X' ? 'tt-x' : (tt[i] ? 'tt-one' : 'tt-zero');
        html += `<td class="${ttClass}">${tt[i]}</td></tr>`;
    }
    html += '</tbody></table>';
    document.getElementById('ttOutputContainer').innerHTML = html;
    html += '</tbody></table></div>';
    return html;
}

// ------------------------------------------------------------------
// AST Construction & Universal Gate Generation
// ------------------------------------------------------------------

function buildStandardAST(sopTerms) {
    if (sopTerms.length === 0) return { type: 'CONST', value: 0 };
    if (sopTerms[0][0] === '1') return { type: 'CONST', value: 1 };
@@ -339,9 +423,7 @@ function astEquals(n1, n2) {
    let len2 = n2.children ? n2.children.length : 0;
    if (len1 !== len2) return false;
    if (len1 === 0) return true;
    for (let i = 0; i < len1; i++) {
        if (!astEquals(n1.children[i], n2.children[i])) return false;
    }
    for (let i = 0; i < len1; i++) if (!astEquals(n1.children[i], n2.children[i])) return false;
    return true;
}

@@ -393,12 +475,14 @@ function verifyASTs(vars, ttOriginal, astSOP, astNAND, astNOR) {
    return true;
}

// ------------------------------------------------------------------
// SVG ENGINE (2D Layouting)
// ------------------------------------------------------------------

function cloneTree(node) {
    if (!node) return null;
    let clone = { type: node.type, value: node.value };
    if (node.children) {
        clone.children = node.children.map(c => cloneTree(c));
    }
    if (node.children) clone.children = node.children.map(cloneTree);
    return clone;
}

@@ -412,8 +496,7 @@ function layoutNode(node) {
        totalH += dim.h;
        maxW = Math.max(maxW, dim.w);
    });
    let gap = 25; 
    node.h = Math.max(totalH + (node.children.length - 1) * gap, 60);
    node.h = Math.max(totalH + (node.children.length - 1) * 25, 60);
    node.w = maxW + 110; 
    return {w: node.w, h: node.h};
}
@@ -423,8 +506,7 @@ function positionNode(node, x, y) {
    if (!node.children || node.children.length === 0) return;

    let totalH = node.children.reduce((sum, c) => sum + c.h, 0);
    let totalGap = (node.children.length - 1) * 25;
    let startY = y - (totalH + totalGap) / 2;
    let startY = y - (totalH + (node.children.length - 1) * 25) / 2;

    node.children.forEach(c => {
        let childY = startY + c.h / 2;
@@ -433,39 +515,17 @@ function positionNode(node, x, y) {
    });
}

function getGateInX(type, x) {
    if (type === 'OR' || type === 'NOR') return x - 15; 
    return x - 20; 
}

function getGateOutX(type, x) {
    if (type === 'VAR' || type === 'CONST') return x + 20;
    if (type === 'NOT') return x + 13;
    if (type === 'AND' || type === 'OR') return x + 20;
    if (type === 'NAND' || type === 'NOR') return x + 28;
    return x;
}

function renderAST(originalNode) {
    let node = cloneTree(originalNode);
    
    if(node.type === 'CONST') {
        return `
        <svg width="200" height="80" xmlns="http://www.w3.org/2000/svg">
            <rect x="20" y="25" width="40" height="30" rx="4" fill="#f8fafc" stroke="#64748b" stroke-width="1.5"/>
            <text x="40" y="45" font-family="monospace" font-size="15" font-weight="bold" fill="#0f172a" text-anchor="middle">${node.value}</text>
            <path d="M 60,40 L 120,40" stroke="#0f172a" stroke-width="2" fill="none"/>
            <text x="130" y="45" font-family="sans-serif" font-weight="bold" fill="#0f172a">Out</text>
        </svg>`;
    }
    if(node.type === 'CONST') return `<svg width="200" height="60"><text x="100" y="35" text-anchor="middle" font-family="sans-serif">Output is constant ${node.value}</text></svg>`;

    layoutNode(node);
    positionNode(node, 0, 0); 

    let bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    function calcBounds(n) {
        bounds.minX = Math.min(bounds.minX, n.x - 40);
        bounds.maxX = Math.max(bounds.maxX, n.x + 40);
        bounds.maxX = Math.max(bounds.maxX, n.x + 60);
        bounds.minY = Math.min(bounds.minY, n.y - 40);
        bounds.maxY = Math.max(bounds.maxY, n.y + 40);
        if(n.children) n.children.forEach(calcBounds);
@@ -482,31 +542,31 @@ function renderAST(originalNode) {
    }
    applyShift(node);

    let svgWidth = (bounds.maxX - bounds.minX) + (padX * 2) + 60; 
    let svgWidth = (bounds.maxX - bounds.minX) + (padX * 2); 
    let svgHeight = (bounds.maxY - bounds.minY) + (padY * 2);

    let svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;
    let svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="user-select:none;">`;
    svg += drawConnections(node);
    svg += drawNodes(node);

    let outPinX = getGateOutX(node.type, node.x);
    svg += `<path d="M ${outPinX},${node.y} L ${outPinX + 30},${node.y}" stroke="#0f172a" stroke-width="2" fill="none"/>`;
    svg += `<text x="${outPinX + 40}" y="${node.y + 5}" font-family="sans-serif" font-weight="bold" fill="#0f172a">Out</text>`;
    let outX = node.type.includes('N') ? node.x + 28 : (node.type==='VAR' ? node.x+20 : node.x+20);
    if(node.type === 'NOT') outX = node.x + 13;
    svg += `<path d="M ${outX},${node.y} L ${outX + 30},${node.y}" stroke="#0f172a" stroke-width="2" fill="none"/>`;
    svg += `<text x="${outX + 40}" y="${node.y + 5}" font-family="sans-serif" font-weight="bold" fill="#0f172a">Out</text>`;
    svg += `</svg>`;
    return svg;
}

function drawConnections(node) {
    if (!node.children) return "";
    let svg = "";
    let numChildren = node.children.length;

    node.children.forEach((c, idx) => {
        let outX = getGateOutX(c.type, c.x);
        let inX = getGateInX(node.type, node.x);

        let spread = Math.min(24, (numChildren - 1) * 12);
        let step = numChildren > 1 ? spread / (numChildren - 1) : 0;
        let outX = c.type.includes('N') ? c.x+28 : (c.type==='VAR'||c.type==='CONST' ? c.x+20 : c.x+20);
        if(c.type === 'NOT') outX = c.x + 13;
        
        let inX = (node.type === 'OR' || node.type === 'NOR') ? node.x - 15 : node.x - 20;
        let spread = Math.min(24, (node.children.length - 1) * 12);
        let step = node.children.length > 1 ? spread / (node.children.length - 1) : 0;
        let inY = (node.y - spread / 2) + (idx * step);

        let midX = outX + (inX - outX) / 2;
@@ -518,9 +578,7 @@ function drawConnections(node) {

function drawNodes(node) {
    let svg = "";
    if (node.children) {
        node.children.forEach(c => { svg += drawNodes(c); });
    }
    if (node.children) node.children.forEach(c => { svg += drawNodes(c); });
    let nx = node.x, ny = node.y;

    if (node.type === 'VAR' || node.type === 'CONST') {
@@ -546,3 +604,51 @@ function drawNodes(node) {
    }
    return svg;
}

// ------------------------------------------------------------------
// ARITHMETIC PRE-CONFIGURATIONS
// ------------------------------------------------------------------

function getArithmeticConfig(type) {
    if (type === 'ha') return [
        { name: 'Half Adder (Sum)', vars: ['A','B'], tt: [0,1,1,0] },
        { name: 'Half Adder (Carry)', vars: ['A','B'], tt: [0,0,0,1] }
    ];
    if (type === 'fa') return [
        { name: 'Full Adder (Sum)', vars: ['A','B','Cin'], tt: [0,1,1,0,1,0,0,1] },
        { name: 'Full Adder (Cout)', vars: ['A','B','Cin'], tt: [0,0,0,1,0,1,1,1] }
    ];
    if (type === 'hs') return [
        { name: 'Half Subtractor (Diff)', vars: ['A','B'], tt: [0,1,1,0] },
        { name: 'Half Subtractor (Bout)', vars: ['A','B'], tt: [0,1,0,0] }
    ];
    if (type === 'fs') return [
        { name: 'Full Subtractor (Diff)', vars: ['A','B','Bin'], tt: [0,1,1,0,1,0,0,1] },
        { name: 'Full Subtractor (Bout)', vars: ['A','B','Bin'], tt: [0,1,1,1,0,0,0,1] }
    ];
    if (type === 'mult2') return [
        { name: '2x2 Multiplier (P3 / MSB)', vars: ['A1','A0','B1','B0'], tt: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1] },
        { name: '2x2 Multiplier (P2)', vars: ['A1','A0','B1','B0'], tt: [0,0,0,0, 0,0,0,0, 0,0,0,1, 0,0,1,0] },
        { name: '2x2 Multiplier (P1)', vars: ['A1','A0','B1','B0'], tt: [0,0,0,0, 0,0,1,1, 0,0,1,1, 0,1,0,0] },
        { name: '2x2 Multiplier (P0 / LSB)', vars: ['A1','A0','B1','B0'], tt: [0,0,0,0, 0,1,0,1, 0,0,0,0, 0,1,0,1] }
    ];
}

function renderBlockDiagram(type) {
    const div = document.createElement('div');
    div.className = 'block-diagram';
    let title = "", inputs = "", outputs = "";
    
    if(type === 'ha') { title = "Half Adder"; inputs = "<div class='block-pin in'>A</div><div class='block-pin in'>B</div>"; outputs = "<div class='block-pin out'>Sum</div><div class='block-pin out'>Carry</div>"; }
    else if(type === 'fa') { title = "Full Adder"; inputs = "<div class='block-pin in'>A</div><div class='block-pin in'>B</div><div class='block-pin in'>Cin</div>"; outputs = "<div class='block-pin out'>Sum</div><div class='block-pin out'>Cout</div>"; }
    else if(type === 'hs') { title = "Half Subtractor"; inputs = "<div class='block-pin in'>A</div><div class='block-pin in'>B</div>"; outputs = "<div class='block-pin out'>Diff</div><div class='block-pin out'>Bout</div>"; }
    else if(type === 'fs') { title = "Full Subtractor"; inputs = "<div class='block-pin in'>A</div><div class='block-pin in'>B</div><div class='block-pin in'>Bin</div>"; outputs = "<div class='block-pin out'>Diff</div><div class='block-pin out'>Bout</div>"; }
    else if(type === 'mult2') { title = "2x2 Multiplier"; inputs = "<div class='block-pin in'>A1, A0</div><div class='block-pin in'>B1, B0</div>"; outputs = "<div class='block-pin out'>P3 (MSB)</div><div class='block-pin out'>P2</div><div class='block-pin out'>P1</div><div class='block-pin out'>P0</div>"; }

    div.innerHTML = `<div class="block-box">
        <div class="block-inputs">${inputs}</div>
        ${title}
        <div class="block-outputs">${outputs}</div>
    </div>`;
    return div;
}
