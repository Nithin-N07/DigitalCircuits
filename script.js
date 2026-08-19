console.log("Advanced Logic Synthesizer Engine V5: Loaded");

document.addEventListener('DOMContentLoaded', () => {
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

    // Min/Max Radio Toggle UX
    document.querySelectorAll('input[name="termType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('lblTerms').innerText = 
                e.target.value === 'minterms' ? 'Minterms (comma separated integers):' : 'Maxterms (comma separated integers):';
        });
    });

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
        let synthesisQueue = []; // Supports multi-output (e.g. Adders)

        if (activeTab === 'tab-expr') {
            const expr = document.getElementById('inputExpr').value;
            const exprDC = document.getElementById('inputExprDC').value;
            if(!expr.trim()) throw new Error("Expression cannot be empty.");
            
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
                
                let isDC = exprDC.trim() ? evaluateExpression(exprDC, inputVals) : 0;
                if (isDC) {
                    tt.push('X');
                } else {
                    tt.push(evaluateExpression(expr, inputVals));
                }
            }
            synthesisQueue.push({ name: 'Boolean Function', vars: vars, tt: tt });
        } 
        else if (activeTab === 'tab-minmax') {
            const varsStr = document.getElementById('inputVarsMin').value;
            const vars = [...new Set(varsStr.toUpperCase().match(/[A-Z]/g) || [])].sort();
            if(vars.length === 0 || vars.length > 6) throw new Error("Enter 1-6 valid variables.");
            
            const isMinterm = document.querySelector('input[name="termType"]:checked').value === 'minterms';
            const terms = document.getElementById('inputTerms').value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
            const dontCares = document.getElementById('inputDontCares').value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
            
            let tt = [];
            const rows = Math.pow(2, vars.length);
            for (let i = 0; i < rows; i++) {
                if (dontCares.includes(i)) tt.push('X');
                else if (terms.includes(i)) tt.push(isMinterm ? 1 : 0);
                else tt.push(isMinterm ? 0 : 1);
            }
            synthesisQueue.push({ name: 'Boolean Function', vars: vars, tt: tt });
        }
        else if (activeTab === 'tab-tt') {
            const container = document.getElementById('ttInputContainer');
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
    let norm = expr.toUpperCase().replace(/\s+/g, '')
                   .replace(/AND/g, '&').replace(/OR/g, '|').replace(/NOT/g, '~').replace(/XOR/g, '^')
                   .replace(/\*/g, '&').replace(/\+/g, '|').replace(/!/g, '~');
    
    // Implicit ANDs (e.g. AB -> A&B, A(B) -> A&(B))
    norm = norm.replace(/([A-Z\)])(?=[A-Z\(~])/g, '$1&');
    
    Object.keys(inputs).forEach(v => {
        norm = norm.replace(new RegExp(v, 'g'), inputs[v]);
    });
    
    // Convert to JS: ^ to !==, & to &&, | to ||
    let jsExpr = norm.replace(/&/g, '&&').replace(/\|/g, '||').replace(/~/g, '!');
    
    // Handle XOR strictly manually by replacing A ^ B with A !== B
    // Simple RegEx won't fix nested XOR properly in JS without AST, but for binary strings:
    jsExpr = jsExpr.replace(/([01!&|()]+)\^([01!&|()]+)/g, '!!($1) !== !!($2)'); 

    try {
        return (new Function(`return !!(${jsExpr});`))() ? 1 : 0;
    } catch(e) {
        throw new Error(`Invalid Boolean Expression context: ${expr}`);
    }
}


// ==========================================
// QUINE-MCCLUSKEY ALGORITHM (WITH DON'T CARES)
// ==========================================
function quineMcCluskey(targets, dontCares, numVars) {
    if (targets.length === 0) return [];
    let allTerms = [...new Set([...targets, ...dontCares])];
    if (allTerms.length === Math.pow(2, numVars)) return ['1'];

    let groups = Array.from({length: numVars + 1}, () => []);
    allTerms.forEach(m => {
        let bin = m.toString(2).padStart(numVars, '0');
        let ones = bin.split('1').length - 1;
        groups[ones].push({ bits: bin, minterms: [m], used: false });
    });

    let primeImplicants = [];
    let changed = true;

    while (changed) {
        changed = false;
        let nextGroups = Array.from({length: numVars + 1}, () => []);
        let newTermsMap = new Set();

        for (let i = 0; i < groups.length - 1; i++) {
            for (let t1 of groups[i]) {
                for (let t2 of groups[i+1]) {
                    let diffIdx = -1, diffs = 0;
                    for (let k = 0; k < numVars; k++) {
                        if (t1.bits[k] !== t2.bits[k]) { diffs++; diffIdx = k; }
                    }
                    if (diffs === 1) {
                        t1.used = true;
                        t2.used = true;
                        let newBits = t1.bits.substring(0, diffIdx) + '-' + t1.bits.substring(diffIdx+1);
                        if (!newTermsMap.has(newBits)) {
                            newTermsMap.add(newBits);
                            let combined = Array.from(new Set([...t1.minterms, ...t2.minterms])).sort((a,b)=>a-b);
                            nextGroups[i].push({ bits: newBits, minterms: combined, used: false });
                            changed = true;
                        }
                    }
                }
            }
        }
        for (let g of groups) {
            for (let t of g) {
                if (!t.used && !primeImplicants.some(pi => pi.bits === t.bits)) {
                    primeImplicants.push(t);
                }
            }
        }
        groups = nextGroups;
    }

    // Uncovered targets (Ignore Don't Cares for coverage)
    let uncovered = new Set(targets);
    let essential = [];

    targets.forEach(m => {
        let covers = primeImplicants.filter(pi => pi.minterms.includes(m));
        if (covers.length === 1) {
            let epi = covers[0];
            if (!essential.includes(epi)) {
                essential.push(epi);
                epi.minterms.forEach(cm => uncovered.delete(cm));
            }
        }
    });

    let solution = [...essential];
    while (uncovered.size > 0) {
        let bestPI = null, maxCover = 0;
        primeImplicants.forEach(pi => {
            if (solution.includes(pi)) return;
            let coverCount = pi.minterms.filter(m => uncovered.has(m)).length;
            if (coverCount > maxCover) { maxCover = coverCount; bestPI = pi; }
        });
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
    const dontCares = tt.map((v, i) => v === 'X' ? i : -1).filter(i => i !== -1);
    
    const qmSOP = quineMcCluskey(minterms1, dontCares, vars.length);
    const qmPOS = quineMcCluskey(minterms0, dontCares, vars.length); 
    
    const sopTerms = qmSOP.map(bits => bitsToLiterals(bits, vars, true));
    const posTerms = qmPOS.map(bits => bitsToLiterals(bits, vars, false));

    const sopEq = formatEquation(sopTerms, false);
    const posEq = formatEquation(posTerms, true);
    
    const ttHtml = generateTruthTableHTML(vars, tt);

    // Build Strict 2-Input ASTs
    const astStandard = buildStandardAST(sopTerms);
    const astStandardPOS = buildPOSStandardAST(posTerms);
    
    // Universal gates conversion
    const astNAND = convertToNAND(astStandard);
    const astNOR = convertToNOR(astStandardPOS);

    // Verification (Ignores X)
    const verified = verifyASTs(vars, tt, astStandard, astNAND, astNOR);
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
    if (bits === '1') return ['1'];
    let term = [];
    for (let i = 0; i < bits.length; i++) {
        if (bits[i] === '1') term.push(isSOP ? vars[i] : `~${vars[i]}`);
        else if (bits[i] === '0') term.push(isSOP ? `~${vars[i]}` : vars[i]);
    }
    return term;
}

function formatEquation(terms, isPOS) {
    if (terms.length === 0) return isPOS ? "1" : "0";
    if (terms[0][0] === '1') return isPOS ? "0" : "1";
    
    let outerJoin = isPOS ? '' : ' + ';
    let innerJoin = isPOS ? ' + ' : '';
    let strings = terms.map(t => {
        let inner = t.join(innerJoin);
        return isPOS ? `(${inner})` : inner;
    });
    return strings.join(outerJoin);
}

function generateTruthTableHTML(vars, tt) {
    let html = '<div class="tt-container"><table><thead><tr>';
    vars.forEach(v => html += `<th>${v}</th>`);
    html += '<th>Output</th></tr></thead><tbody>';
    
    for(let i=0; i<tt.length; i++) {
        html += '<tr>';
        for(let j=0; j<vars.length; j++) {
            let val = (i & (1 << (vars.length - 1 - j))) ? 1 : 0;
            html += `<td>${val}</td>`;
        }
        let ttClass = tt[i] === 'X' ? 'tt-x' : (tt[i] ? 'tt-one' : 'tt-zero');
        html += `<td class="${ttClass}">${tt[i]}</td></tr>`;
    }
    html += '</tbody></table></div>';
    return html;
}

// ------------------------------------------------------------------
// AST Construction & Universal Gate Generation
// ------------------------------------------------------------------

function buildStandardAST(sopTerms) {
    if (sopTerms.length === 0) return { type: 'CONST', value: 0 };
    if (sopTerms[0][0] === '1') return { type: 'CONST', value: 1 };

    let orNodes = sopTerms.map(term => {
        let andNodes = term.map(lit => {
            if (lit.startsWith('~')) return { type: 'NOT', children: [{ type: 'VAR', value: lit.substring(1) }] };
            return { type: 'VAR', value: lit };
        });
        if (andNodes.length === 0) return { type: 'CONST', value: 1 };
        return andNodes.reduce((acc, curr) => ({ type: 'AND', children: [acc, curr] }));
    });
    
    if (orNodes.length === 0) return { type: 'CONST', value: 0 };
    return orNodes.reduce((acc, curr) => ({ type: 'OR', children: [acc, curr] }));
}

function buildPOSStandardAST(posTerms) {
    if (posTerms.length === 0) return { type: 'CONST', value: 1 };
    if (posTerms[0][0] === '1') return { type: 'CONST', value: 0 };

    let andNodes = posTerms.map(term => {
        let orNodes = term.map(lit => {
            if (lit.startsWith('~')) return { type: 'NOT', children: [{ type: 'VAR', value: lit.substring(1) }] };
            return { type: 'VAR', value: lit };
        });
        if (orNodes.length === 0) return { type: 'CONST', value: 0 };
        return orNodes.reduce((acc, curr) => ({ type: 'OR', children: [acc, curr] }));
    });
    
    if (andNodes.length === 0) return { type: 'CONST', value: 1 };
    return andNodes.reduce((acc, curr) => ({ type: 'AND', children: [acc, curr] }));
}

function astEquals(n1, n2) {
    if (n1 === n2) return true;
    if (!n1 || !n2 || n1.type !== n2.type || n1.value !== n2.value) return false;
    let len1 = n1.children ? n1.children.length : 0;
    let len2 = n2.children ? n2.children.length : 0;
    if (len1 !== len2) return false;
    if (len1 === 0) return true;
    for (let i = 0; i < len1; i++) if (!astEquals(n1.children[i], n2.children[i])) return false;
    return true;
}

function NOT_NAND(node) {
    if (node.type === 'NAND' && astEquals(node.children[0], node.children[1])) return node.children[0];
    return { type: 'NAND', children: [node, node] };
}
function convertToNAND(node) {
    if (node.type === 'VAR' || node.type === 'CONST') return node;
    if (node.type === 'NOT') return NOT_NAND(convertToNAND(node.children[0]));
    if (node.type === 'AND') return NOT_NAND({ type: 'NAND', children: [convertToNAND(node.children[0]), convertToNAND(node.children[1])] });
    if (node.type === 'OR') return { type: 'NAND', children: [NOT_NAND(convertToNAND(node.children[0])), NOT_NAND(convertToNAND(node.children[1]))] };
}

function NOT_NOR(node) {
    if (node.type === 'NOR' && astEquals(node.children[0], node.children[1])) return node.children[0];
    return { type: 'NOR', children: [node, node] };
}
function convertToNOR(node) {
    if (node.type === 'VAR' || node.type === 'CONST') return node;
    if (node.type === 'NOT') return NOT_NOR(convertToNOR(node.children[0]));
    if (node.type === 'AND') return { type: 'NOR', children: [NOT_NOR(convertToNOR(node.children[0])), NOT_NOR(convertToNOR(node.children[1]))] };
    if (node.type === 'OR') return NOT_NOR({ type: 'NOR', children: [convertToNOR(node.children[0]), convertToNOR(node.children[1])] });
}

function evaluateAST(node, inputs) {
    if (!node) return 0;
    if (node.type === 'CONST') return node.value;
    if (node.type === 'VAR') return inputs[node.value];
    if (node.type === 'NOT') return !evaluateAST(node.children[0], inputs);
    if (node.type === 'AND') return node.children.reduce((acc, c) => acc && evaluateAST(c, inputs), true);
    if (node.type === 'OR') return node.children.reduce((acc, c) => acc || evaluateAST(c, inputs), false);
    if (node.type === 'NAND') return !(node.children.reduce((acc, c) => acc && evaluateAST(c, inputs), true));
    if (node.type === 'NOR') return !(node.children.reduce((acc, c) => acc || evaluateAST(c, inputs), false));
}

function verifyASTs(vars, ttOriginal, astSOP, astNAND, astNOR) {
    for(let i=0; i<ttOriginal.length; i++) {
        if (ttOriginal[i] === 'X') continue;
        let inputVals = {};
        for(let j=0; j<vars.length; j++) {
            inputVals[vars[j]] = (i & (1 << (vars.length - 1 - j))) ? 1 : 0;
        }
        let resSOP = evaluateAST(astSOP, inputVals) ? 1 : 0;
        let resNAND = evaluateAST(astNAND, inputVals) ? 1 : 0;
        let resNOR = evaluateAST(astNOR, inputVals) ? 1 : 0;
        if(resSOP !== ttOriginal[i] || resNAND !== ttOriginal[i] || resNOR !== ttOriginal[i]) return false;
    }
    return true;
}

// ------------------------------------------------------------------
// SVG ENGINE (2D Layouting)
// ------------------------------------------------------------------

function cloneTree(node) {
    if (!node) return null;
    let clone = { type: node.type, value: node.value };
    if (node.children) clone.children = node.children.map(cloneTree);
    return clone;
}

function layoutNode(node) {
    if (node.type === 'VAR' || node.type === 'CONST') {
        node.w = 50; node.h = 40; return {w: 50, h: 40};
    }
    let totalH = 0; let maxW = 0;
    node.children.forEach((c) => {
        let dim = layoutNode(c);
        totalH += dim.h;
        maxW = Math.max(maxW, dim.w);
    });
    node.h = Math.max(totalH + (node.children.length - 1) * 25, 60);
    node.w = maxW + 110; 
    return {w: node.w, h: node.h};
}

function positionNode(node, x, y) {
    node.x = x; node.y = y;
    if (!node.children || node.children.length === 0) return;
    
    let totalH = node.children.reduce((sum, c) => sum + c.h, 0);
    let startY = y - (totalH + (node.children.length - 1) * 25) / 2;
    
    node.children.forEach(c => {
        let childY = startY + c.h / 2;
        positionNode(c, x - 110, childY); 
        startY += c.h + 25;
    });
}

function renderAST(originalNode) {
    let node = cloneTree(originalNode);
    if(node.type === 'CONST') return `<svg width="200" height="60"><text x="100" y="35" text-anchor="middle" font-family="sans-serif">Output is constant ${node.value}</text></svg>`;
    
    layoutNode(node);
    positionNode(node, 0, 0); 

    let bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    function calcBounds(n) {
        bounds.minX = Math.min(bounds.minX, n.x - 40);
        bounds.maxX = Math.max(bounds.maxX, n.x + 60);
        bounds.minY = Math.min(bounds.minY, n.y - 40);
        bounds.maxY = Math.max(bounds.maxY, n.y + 40);
        if(n.children) n.children.forEach(calcBounds);
    }
    calcBounds(node);

    let padX = 40; let padY = 40;
    let shiftX = -bounds.minX + padX;
    let shiftY = -bounds.minY + padY;
    
    function applyShift(n) {
        n.x += shiftX; n.y += shiftY;
        if(n.children) n.children.forEach(applyShift);
    }
    applyShift(node);

    let svgWidth = (bounds.maxX - bounds.minX) + (padX * 2); 
    let svgHeight = (bounds.maxY - bounds.minY) + (padY * 2);

    let svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="user-select:none;">`;
    svg += drawConnections(node);
    svg += drawNodes(node);
    
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
    node.children.forEach((c, idx) => {
        let outX = c.type.includes('N') ? c.x+28 : (c.type==='VAR'||c.type==='CONST' ? c.x+20 : c.x+20);
        if(c.type === 'NOT') outX = c.x + 13;
        
        let inX = (node.type === 'OR' || node.type === 'NOR') ? node.x - 15 : node.x - 20;
        let spread = Math.min(24, (node.children.length - 1) * 12);
        let step = node.children.length > 1 ? spread / (node.children.length - 1) : 0;
        let inY = (node.y - spread / 2) + (idx * step);

        let midX = outX + (inX - outX) / 2;
        svg += `<path d="M ${outX},${c.y} H ${midX} V ${inY} H ${inX}" fill="none" stroke="#64748b" stroke-width="2"/>`;
        svg += drawConnections(c);
    });
    return svg;
}

function drawNodes(node) {
    let svg = "";
    if (node.children) node.children.forEach(c => { svg += drawNodes(c); });
    let nx = node.x, ny = node.y;
    
    if (node.type === 'VAR' || node.type === 'CONST') {
        svg += `<rect x="${nx-18}" y="${ny-15}" width="36" height="30" rx="4" fill="#f8fafc" stroke="#64748b" stroke-width="1.5"/>`;
        svg += `<text x="${nx}" y="${ny+5}" font-family="monospace" font-size="15" font-weight="bold" fill="#0f172a" text-anchor="middle">${node.value}</text>`;
    } else if (node.type === 'AND') {
        svg += `<path d="M ${nx-20},${ny-20} L ${nx},${ny-20} A 20,20 0 0,1 ${nx},${ny+20} L ${nx-20},${ny+20} Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${nx-5}" y="${ny+3}" font-size="9" font-family="sans-serif" text-anchor="middle" font-weight="bold">AND</text>`;
    } else if (node.type === 'OR') {
        svg += `<path d="M ${nx-20},${ny-20} Q ${nx},${ny} ${nx-20},${ny+20} Q ${nx+10},${ny+20} ${nx+20},${ny} Q ${nx+10},${ny-20} ${nx-20},${ny-20} Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${nx}" y="${ny+3}" font-size="9" font-family="sans-serif" text-anchor="middle" font-weight="bold">OR</text>`;
    } else if (node.type === 'NOT') {
        svg += `<path d="M ${nx-20},${ny-15} L ${nx+5},${ny} L ${nx-20},${ny+15} Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<circle cx="${nx+9}" cy="${ny}" r="4" fill="white" stroke="#0f172a" stroke-width="2"/>`;
    } else if (node.type === 'NAND') {
        svg += `<path d="M ${nx-20},${ny-20} L ${nx},${ny-20} A 20,20 0 0,1 ${nx},${ny+20} L ${nx-20},${ny+20} Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<circle cx="${nx+24}" cy="${ny}" r="4" fill="white" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${nx-5}" y="${ny+3}" font-size="8.5" font-family="sans-serif" text-anchor="middle" font-weight="bold">NAND</text>`;
    } else if (node.type === 'NOR') {
        svg += `<path d="M ${nx-20},${ny-20} Q ${nx},${ny} ${nx-20},${ny+20} Q ${nx+10},${ny+20} ${nx+20},${ny} Q ${nx+10},${ny-20} ${nx-20},${ny-20} Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<circle cx="${nx+24}" cy="${ny}" r="4" fill="white" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${nx}" y="${ny+3}" font-size="8.5" font-family="sans-serif" text-anchor="middle" font-weight="bold">NOR</text>`;
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
