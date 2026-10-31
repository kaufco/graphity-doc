// Refines a diagram that Mermaid has rendered, in the page of the browser that rendered it: a plain
// script, whose function fitDiagram that page calls with an element holding the SVG. It works on the
// finished drawing and moves no node, so two diagrams with the same nodes still match.

// The path of an edge stops this far before a node that it reaches with an arrowhead.
const ARROW_GAP = 4;
// The length of Mermaid's arrowheads in their own coordinates, and their length on the page.
const ARROW_LENGTH = 11.5;
const ARROW_WIDTH = 10.5;
const CORNER_RADIUS = 7;
// A shift of an edge by this much or less is a jog in its line, not a bend.
const MAX_JOG = 6;
// An edge that passes a node keeps this distance.
const NODE_CLEARANCE = 8;
// The red, green and blue of the shadow that Mermaid gives a frame.
const FRAME_SHADOW = 185;
const LABEL_OUTLINE = 4;
const SELF_LOOP_HALF_SPREAD = 10;
const SELF_LOOP_MIN_DEPTH = 16;
const SELF_LOOP_RADIUS = 6;

function translation(element) {
	const at = /translate\(\s*([-\d.]+)[\s,]+([-\d.]+)\s*\)/.exec(element?.getAttribute('transform') ?? '');
	return at && { x: Number(at[1]), y: Number(at[2]) };
}

const isSelfLoop = (edge) => /L_(.+)_\1_\d+$/.test(edge.id);

// ---------------------------------------------------------------------------------------------------
// The route of an edge

/** The points where an edge starts, bends and ends. Mermaid rounds a bend, and hops over a crossing. */
function cornersOf(edge) {
	const points = [];
	for (const [, command, numbers] of edge.getAttribute('d').matchAll(/([MLQA])([^MLQA]*)/g)) {
		const values = numbers.trim().split(/[\s,]+/).map(Number);
		if (command === 'Q') points.push({ x: values[0], y: values[1] });
		points.push({ x: values.at(-2), y: values.at(-1) });
	}
	const cross = (a, b, c) => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
	const corners = [];
	for (const point of points) {
		const [a, b] = corners.slice(-2);
		if (b && Math.hypot(point.x - b.x, point.y - b.y) < 0.01) continue;
		if (a && b && Math.abs(cross(a, b, point)) < 0.5) corners.pop();
		corners.push(point);
	}
	return corners;
}

/** Takes out the small steps that a line gets where two points of its route nearly line up. */
function withoutJogs(corners) {
	for (let i = 1; i + 2 < corners.length; i++) {
		const [a, b, c, d] = corners.slice(i - 1, i + 3);
		const vertical = Math.abs(a.x - b.x) < Math.abs(a.y - b.y);
		const sameWay = vertical ? (b.y - a.y) * (d.y - c.y) > 0 : (b.x - a.x) * (d.x - c.x) > 0;
		if (!sameWay || Math.hypot(c.x - b.x, c.y - b.y) > MAX_JOG) continue;
		corners.splice(i, 3, vertical ? { x: b.x, y: d.y } : { x: d.x, y: b.y });
		i--;
	}
	return corners;
}

/** The boxes of the nodes of one diagram level, in the coordinates of its edges. */
function nodeBoxes(root) {
	return [...root.querySelectorAll(':scope > g.nodes > g.node')].flatMap((node) => {
		const rect = node.querySelector(':scope > rect.label-container');
		const at = translation(node);
		if (!rect || !at) return [];
		const [x, y] = [at.x + rect.x.baseVal.value, at.y + rect.y.baseVal.value];
		return [{ left: x, top: y, right: x + rect.width.baseVal.value, bottom: y + rect.height.baseVal.value }];
	});
}

/**
 * Mermaid can route an edge through a node that lies in its way, where it reads as two edges. Each
 * straight piece that does so moves aside, the first and the last along the node that they leave or
 * reach.
 */
function leaveNodesFree(corners, boxes) {
	const near = (point, box) =>
		point.x >= box.left - 5 && point.x <= box.right + 5 && point.y >= box.top - 5 && point.y <= box.bottom + 5;
	const [from, to] = [boxes.find((box) => near(corners[0], box)), boxes.find((box) => near(corners.at(-1), box))];
	for (let i = 0; i + 1 < corners.length; i++) {
		const [a, b] = [corners[i], corners[i + 1]];
		const keeps = Math.abs(a.x - b.x) < 0.5 ? 'x' : Math.abs(a.y - b.y) < 0.5 ? 'y' : undefined;
		if (!keeps) continue;
		const [low, high, start, end] = keeps === 'x' ? ['left', 'right', 'top', 'bottom'] : ['top', 'bottom', 'left', 'right'];
		const along = keeps === 'x' ? 'y' : 'x';
		const fits = (place, box) => !box || (place > box[low] + 1 && place < box[high] - 1);
		for (const box of boxes) {
			if (box === from || box === to) continue;
			const beside = a[keeps] < box[low] - NODE_CLEARANCE || a[keeps] > box[high] + NODE_CLEARANCE;
			const past = Math.max(a[along], b[along]) <= box[start] || Math.min(a[along], b[along]) >= box[end];
			if (beside || past) continue;
			const free = [box[low] - NODE_CLEARANCE, box[high] + NODE_CLEARANCE]
				.sort((p, q) => Math.abs(p - a[keeps]) - Math.abs(q - a[keeps]))
				.find((place) => (i > 0 || fits(place, from)) && (i + 2 < corners.length || fits(place, to)));
			if (free !== undefined) a[keeps] = b[keeps] = free;
		}
	}
}

function drawCorners(edge, corners) {
	const toward = (from, to, distance) => {
		const length = Math.hypot(to.x - from.x, to.y - from.y);
		return `${from.x + ((to.x - from.x) * distance) / length},${from.y + ((to.y - from.y) * distance) / length}`;
	};
	let path = `M${corners[0].x},${corners[0].y}`;
	for (let i = 1; i + 1 < corners.length; i++) {
		const [a, b, c] = corners.slice(i - 1, i + 2);
		const radius = Math.min(CORNER_RADIUS, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - b.x, c.y - b.y) / 2);
		path += `L${toward(b, a, radius)}Q${b.x},${b.y} ${toward(b, c, radius)}`;
	}
	edge.setAttribute('d', `${path}L${corners.at(-1).x},${corners.at(-1).y}`);
}

function routeEdges(svg) {
	for (const root of svg.querySelectorAll('g.root')) {
		const boxes = nodeBoxes(root);
		for (const edge of root.querySelectorAll(':scope > g.edgePaths > path.flowchart-link')) {
			if (isSelfLoop(edge)) continue;
			const corners = withoutJogs(cornersOf(edge));
			leaveNodesFree(corners, boxes);
			drawCorners(edge, corners);
		}
	}
}

// ---------------------------------------------------------------------------------------------------
// The ends of an edge

// Both arrowheads get the same size and reach the node, past the end of their path; the border of the
// node lies on top of the tip. Those of a colored edge get its color at both ends.
function fitArrows(svg) {
	const reach = (ARROW_GAP * ARROW_LENGTH) / ARROW_WIDTH;
	for (const marker of svg.querySelectorAll('marker[id*="pointEnd-margin"]')) {
		marker.setAttribute('refX', ARROW_LENGTH - reach);
	}
	for (const marker of svg.querySelectorAll('marker[id*="pointStart-margin"]')) {
		marker.setAttribute('refX', reach);
		marker.setAttribute('markerWidth', ARROW_WIDTH);
		const color = /__(\w+)$/.exec(marker.id);
		if (color) marker.firstElementChild.setAttribute('fill', `#${color[1]}`);
	}
}

// Mermaid leaves ARROW_GAP between a node and the end of an edge with an arrowhead, or one that could
// have one: an edge `a <--> b` with `marker-end:none`, the way to draw an arrow at the source of an edge
// without changing the layout, has to reach its node. A self-loop is a narrow sliver at the side of its
// node: it is drawn again, with its ends further apart. The line stops under the arrowheads either way.
function fitEdge(edge) {
	const arrowAtStart = edge.hasAttribute('marker-start');
	const reversed = /marker-end:\s*none/.test(edge.getAttribute('style'));
	const arrowAtEnd = edge.hasAttribute('marker-end') && !reversed;
	const length = edge.getTotalLength();
	const start = edge.getPointAtLength(0);
	const end = edge.getPointAtLength(length);
	if (isSelfLoop(edge)) {
		drawSelfLoop(edge, start, end, arrowAtStart, arrowAtEnd);
	} else if (reversed) {
		const before = edge.getPointAtLength(length - 1);
		const toNode = (a, b) => b + (b - a) * ARROW_GAP;
		edge.setAttribute('d', `${edge.getAttribute('d')}L${toNode(before.x, end.x)},${toNode(before.y, end.y)}`);
	}
	const skipStart = arrowAtStart ? ARROW_GAP : 0;
	const skipEnd = arrowAtEnd ? ARROW_GAP : 0;
	const drawn = edge.getTotalLength() - skipStart - skipEnd;
	edge.setAttribute(
		'style',
		edge.getAttribute('style').replace(/stroke-dasharray:\s*0 [\d.]+ [\d.]+ [\d.]+/, `stroke-dasharray: 0 ${skipStart} ${drawn} ${skipEnd}`),
	);
}

function drawSelfLoop(edge, start, end, arrowAtStart, arrowAtEnd) {
	const first = edge.getPointAtLength(1);
	const away = { x: first.x - start.x, y: first.y - start.y };
	const spread = { x: end.x - start.x, y: end.y - start.y };
	const turn = Math.sign(away.x * spread.y - away.y * spread.x);
	const along = { x: -away.y * turn, y: away.x * turn };
	const box = edge.getBBox();
	const lift = arrowAtStart ? ARROW_GAP : 0;
	const depth = Math.max(Math.abs(away.x) * box.width + Math.abs(away.y) * box.height + lift, SELF_LOOP_MIN_DEPTH);
	// The point of the side of the node between the ends of the loop.
	const half = (spread.x * along.x + spread.y * along.y) / 2;
	const x0 = start.x - away.x * lift + along.x * half;
	const y0 = start.y - away.y * lift + along.y * half;
	const point = (out, side) => `${x0 + away.x * out + along.x * side},${y0 + away.y * out + along.y * side}`;
	const [h, r] = [SELF_LOOP_HALF_SPREAD, SELF_LOOP_RADIUS];
	edge.setAttribute(
		'd',
		`M${point(lift, -h)}L${point(depth - r, -h)}Q${point(depth, -h)} ${point(depth, r - h)}` +
			`L${point(depth, h - r)}Q${point(depth, h)} ${point(depth - r, h)}L${point(arrowAtEnd ? ARROW_GAP : 0, h)}`,
	);
	// The label, with its background, stays outside of the loop.
	const label = edge.ownerSVGElement.querySelector(`.edgeLabel > [data-id="${edge.dataset.id}"]`);
	const at = translation(label?.parentElement);
	if (at) {
		const size = label.querySelector('rect.background');
		const reach = depth + (Math.abs(away.x) * size.width.baseVal.value + Math.abs(away.y) * size.height.baseVal.value) / 2 + 2;
		const missing = Math.max(reach - ((at.x - x0) * away.x + (at.y - y0) * away.y), 0);
		label.parentElement.setAttribute('transform', `translate(${at.x + away.x * missing}, ${at.y + away.y * missing})`);
	}
}

// ---------------------------------------------------------------------------------------------------
// Labels

/** A label stands on its edge, also after the edge has moved. */
function centerLabel(edge) {
	const label = edge.ownerSVGElement.querySelector(`.edgeLabel > [data-id="${edge.dataset.id}"]`)?.parentElement;
	const at = translation(label);
	if (!at) return;
	let nearest = at;
	let distance = Infinity;
	for (let position = 0; position <= edge.getTotalLength(); position++) {
		const point = edge.getPointAtLength(position);
		const here = Math.hypot(point.x - at.x, point.y - at.y);
		if (here < distance) [nearest, distance] = [point, here];
	}
	label.setAttribute('transform', `translate(${nearest.x}, ${nearest.y})`);
}

/** The frames with a fill, the outer ones first; one without fill is hidden, to keep a layout. */
function framesOf(svg) {
	return [...svg.querySelectorAll('g.cluster > rect')]
		.map((rect) => ({ box: rect.getBoundingClientRect(), fill: getComputedStyle(rect).fill.match(/[\d.]+/g)?.map(Number) }))
		.filter((frame) => frame.fill)
		.sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);
}

// A label stays readable on top of an edge with an outline in the color behind it, which interrupts the
// edge around the letters: a background would show as a rectangle on a frame. That color is white under
// the fills of the frames around the label, each over its own shadow, which shows through it.
function outlineLabel(text, frames) {
	const { x, y, width, height } = text.getBoundingClientRect();
	const [cx, cy] = [x + width / 2, y + height / 2];
	let color = [255, 255, 255];
	for (const { box, fill } of frames) {
		if (cx < box.left || cx > box.right || cy < box.top || cy > box.bottom) continue;
		const alpha = fill[3] ?? 1;
		color = color.map((channel, i) => {
			const shadow = channel + (FRAME_SHADOW - channel) * alpha;
			return Math.round(shadow + (fill[i] - shadow) * alpha);
		});
	}
	text.style.setProperty('paint-order', 'stroke');
	text.style.setProperty('stroke', `rgb(${color.join(', ')})`);
	text.style.setProperty('stroke-width', `${LABEL_OUTLINE}px`);
	text.style.setProperty('stroke-linejoin', 'round');
}

// Mermaid centers the title of a frame at its top, where the edges into the frame usually run. It moves
// to the left edge, and above the edges that still cross it.
function alignClusterLabels(svg, frames) {
	for (const cluster of svg.querySelectorAll('g.cluster')) {
		const rect = cluster.querySelector(':scope > rect');
		const label = cluster.querySelector(':scope > g.cluster-label');
		const at = translation(label);
		if (!rect || !at) continue;
		label.setAttribute('transform', `translate(${Number(rect.getAttribute('x')) + 8}, ${at.y})`);
		if (getComputedStyle(rect).fill !== 'none') outlineLabel(label.querySelector('text'), frames);
		const overlay = document.createElementNS(cluster.namespaceURI, 'g');
		overlay.setAttribute('class', cluster.getAttribute('class'));
		overlay.append(label);
		cluster.closest('g.root').append(overlay);
	}
}

// ---------------------------------------------------------------------------------------------------
// Shadows

// Edges lie below the nodes, so the shadow of a node would fall on the edges that reach it. It comes from
// an opaque copy below the edges instead, which also keeps the transparent fill of a node the same on any
// background. A hidden node, without fill, has no shadow.
function lowerNodeShadows(svg) {
	for (const root of svg.querySelectorAll('g.root')) {
		const layer = document.createElementNS(root.namespaceURI, 'g');
		root.querySelector(':scope > g.edgePaths')?.before(layer);
		for (const node of root.querySelectorAll(':scope > g.nodes > g.node')) {
			const rect = node.querySelector(':scope > rect.label-container');
			if (!rect || getComputedStyle(rect).fill === 'none') continue;
			const shadow = document.createElementNS(rect.namespaceURI, 'rect');
			for (const name of ['x', 'y', 'width', 'height']) shadow.setAttribute(name, rect.getAttribute(name));
			shadow.setAttribute('transform', node.getAttribute('transform'));
			shadow.setAttribute('fill', '#fff');
			shadow.style.setProperty('filter', getComputedStyle(rect).filter);
			rect.style.setProperty('filter', 'none');
			layer.append(shadow);
		}
	}
}

// The element has to be in the document: lengths and computed colors need it.
// eslint-disable-next-line no-unused-vars
function fitDiagram(holder) {
	const frames = framesOf(holder);
	alignClusterLabels(holder, frames);
	lowerNodeShadows(holder);
	fitArrows(holder);
	routeEdges(holder);
	const edges = [...holder.querySelectorAll('path.flowchart-link')];
	for (const edge of edges) fitEdge(edge);
	for (const edge of edges) if (!isSelfLoop(edge)) centerLabel(edge);
	for (const text of holder.querySelectorAll('.edgeLabel text')) outlineLabel(text, frames);
}
