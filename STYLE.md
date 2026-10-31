# Style of the pictures

Everyone who adds or changes a picture in the guide follows these rules, people and agents alike. A
reader who arrives by a deep link sees only one page: picture, legend and caption have to explain
themselves, so all pictures use the same design language. How to write a diagram into a page is in
[README.md](README.md#diagrams).

## Input, context, output

A picture marks what matters on the page. Everything else stays unmarked. There are three roles, and
each has nodes, edges and groups:

- **Input** is an explicit argument of the call, and nothing else. Every node, edge or group that the
  example passes in gets the input mark, a start node as much as an `entry` block. The nodes and edges
  of the graph go in as well, but they are not marked: a function that takes only the graph has no
  input in the legend. An edge on a cycle would be input only if the function asked for something like
  `int[] cycleEdges`. A graph is marked only where a page has to tell two graphs that go in apart; then
  each is an input group. What counts is the call the picture is about: a node that a loop runs over,
  or a call that no picture shows, has no mark.
- **Output** is what the code returns, as far as the example ends with it. If that is nodes, only the
  nodes are output, not the edges that lead to them. An edge is output only if the code returns edges,
  or a graph that has the edge. If the answer of the example is a new graph, the whole graph is output,
  its nodes and its edges; if it contains the graph that went in, only what it adds. A graph that the
  example only asks a question of stays unmarked, and the answer is output. The nodes of an output
  group have no mark of their own, and an input node in it stays blue.
- **Context** is what the picture points out although the code neither takes nor returns it: the edges
  on a cycle, an SCC the page starts from, a node the text talks about.

Read the code of the example to tell them apart. A group that looks like a result may be context, as
the SCC on the page about strong bridges: the call gets only the graph, and it does not return the
SCC.

**Output goes first.** A node or edge that is part of the result gets the output mark, whatever else
it is: an edge of the result that lies on a cycle is green, not orange. Input goes before context. A
node has exactly one mark; two classes on one node give a border of one and a fill of the other.

A single picture that only shows the graph an example builds has no marks: there is nothing to tell
apart.

## Marks and colors

Input is blue and output green, on nodes, edges and groups alike. A group has the color of a node, with
a thinner border and a fainter fill. Context has the color of its role. No other colors, and no marks
of a page's own: a picture that needs a new mark needs it in this table and in
`src/lib/legend.mjs` first.

| Key | General name | Role | Mermaid |
| --- | --- | --- | --- |
| `inputGroup` | Input group | input | `classDef inputGroup fill:#3b82f614,stroke:#3b82f6,stroke-width:1px` |
| `inputNode` | Input node | input | `classDef inputNode fill:#3b82f626,stroke:#3b82f6,stroke-width:2px,color:#1f2328` |
| `inputEdge` | Input edge | input | `linkStyle <n> stroke:#3b82f6,stroke-width:3px` |
| `contextGroup` | Context group | context, gray | `classDef contextGroup fill:#9ca3af14,stroke:#9ca3af,stroke-width:1px` |
| `contextNode` | Context node | context, a purple outline | `classDef contextNode stroke:#8b5cf6,stroke-width:3px` |
| `cycleEdge` | Edge on a cycle | context, orange | `linkStyle <n> stroke:#f59e0b,stroke-width:3px` |
| `omittedEdge` | Omitted edge | context, dashed gray | `linkStyle <n> stroke:#9ca3af,stroke-dasharray:4 3` |
| `outputGroup` | Output group | output | `classDef outputGroup fill:#10b98114,stroke:#10b981,stroke-width:1px` |
| `outputNode` | Output node | output | `classDef outputNode fill:#10b98126,stroke:#10b981,stroke-width:2px,color:#1f2328` |
| `outputEdge` | Output edge | output | `linkStyle <n> stroke:#10b981,stroke-width:3px` |
| `removedEdge` | Removed edge | output, dashed green | `linkStyle <n> stroke:#10b981,stroke-width:3px,stroke-dasharray:4 3` |

A class on a node or a `subgraph` goes in a statement of its own, `class a,b outputNode`: the legend
reads the Mermaid source. Node classes that fill with a transparent color state the text color, which
cannot be derived from such a fill. A block marked ` ```mermaid verbatim ` is what a writer of the library
wrote, on the pages about those writers: it stays as the code writes it, with the classes of its example,
and has no legend; the text of the page explains it.

- **An edge on a cycle** is every edge of the cycle, not only the one that closes it. Which edge closes
  a cycle depends on where a search starts; that one is a back edge, and only a page about back edges
  names it.
- **An omitted edge** is one that an algorithm skips or that a result leaves out, and that the code does
  not return.
- **A removed edge** is one that the code returns and that the graph of the result no longer has: green
  because it is output, dashed because it is left out.

## Pictures before and after

Most pages show two pictures side by side in `<Compare>`.

- **The left picture is the state before the example, the right picture the state after it.** The left
  picture contains no output: it shows what goes in. The right picture may contain input, context and
  output, and an input that is also output is green there.
- **Both keep their nodes in the same places.** Where the right picture adds groups, the left one has
  the same `subgraph` lines with the same titles, made invisible with
  `classDef hidden fill:none,stroke:none,color:#ffffff00`. An edge that only the right picture has appears
  in the left one as an invisible link, `a ~~~ b`. Mermaid then lays out both alike. Only a picture whose
  point is its layout, such as an order from top to bottom, may differ.
- **A pair can also show two graphs** that an example checks one after the other. The two captions then
  name the graphs, and the left picture still has no output.
- **The code builds exactly the graph of the left picture**, and the right picture shows exactly what
  the code returns. Check node IDs and edges by hand, the edges of a result also by test.

Pictures run top to bottom (`flowchart TB`), so that two fit side by side. Left to right is only for a
single picture of a wide, shallow graph.

## Nodes and groups

- **Nodes** show their ID and their name, `"3: nextLine"`, so that the results in the code match the
  picture. On graphs of plain numbers, the ID alone.
- **Group titles are short** (`SCC 4`, `loop 1`). The legend and the text say what a group means.

## Legend

Every picture or pair of pictures with marks has one legend, below the pictures. `<Compare>` shows it by
itself; a single picture with marks goes into `<Figure>`. `legend` gives the marks their names on the page.

- **It lists only the marks that occur.** They are read from the Mermaid source.
- **The columns are Input, Context and Output**, in this order. A column without an entry is left out.
  The headings say the role, so a name does not repeat it.
- **Names are as specific as the page.** A chapter names a mark by what it is there: the output edge of the
  page about strong bridges is `Strong bridge`, its output node `Strong articulation point`, its context
  group `SCC`. The color and the shape of the mark stay the same. The general names of the table are what
  a mark without a name shows.
- **A name says what the caption does not.** Where a whole graph is output, the name of its edges says
  what an arrow means, not only that it is an edge.

```mdx
<Compare
  before="The control flow and its loop"
  after="Strong articulation points and bridges of the loop"
  legend={{ contextGroup: 'SCC', outputNode: 'Strong articulation point', outputEdge: 'Strong bridge' }}
>
```

## Captions

`before` and `after` name what each picture shows.

- **Name the things in the picture**, in the terms of the page and of the legend: "Strong articulation
  points and bridges of the loop".
- **Do not paraphrase the question of the page**, and do not claim more than the picture shows: "The
  edges and blocks the loop needs" is wrong, because a loop does not need its edges and blocks, it
  consists of them, also before the code runs.

## The text around a picture

The legend names and draws the marks. The text does not need to describe them again: "An output group is
a group that the code returned", not "An output group, in a green frame, is ...". Where a sentence does
name a color, it has to match the picture.

## Layout

The build takes care of these on every picture. Do not work around them in the Mermaid source.

- **Arrowheads** touch the node, and have the color of their edge. The shadow of a node lies below the
  edges.
- **Edges** touch the node where they have no arrowhead. An edge that Mermaid routes across another node
  moves aside, its small jogs are straightened, and crossings stay plain.
- **Self-loops** are redrawn with their ends 20px apart. The label of a self-loop stands clear of the
  loop.
- **Labels on edges and group titles** have an outline in the color behind them, also inside nested
  groups: it interrupts an edge around the letters, where a background would show as a rectangle on a
  group. Short labels such as `1` stay readable on top of their edge.
- **Group titles** stand at the top left of their group, above any edge that crosses them.

An arrow at the source of an edge, as in a transposed graph, is `a <--> b` with `marker-end:none` in
`linkStyle`. The layout then stays the same as in the picture with the arrow at the target.

## What fails the build

`npm run check-pictures -- src/content/docs/<chapter>` makes these checks without a build.

- a class or `classDef` that is not a mark or `hidden`, or a `classDef` that differs from the table;
- a `linkStyle` color that is not in the table, and a `style` statement or a class set with `:::`;
- a mark for groups on a node, or a mark for nodes on a group;
- two marks on one node or edge;
- a picture with marks outside of `<Compare>` and `<Figure>`;
- a name in `legend` for a mark that the pictures do not use;
- an output mark in the left picture of a `<Compare>`.

Everything else on this page is for the author to check.
