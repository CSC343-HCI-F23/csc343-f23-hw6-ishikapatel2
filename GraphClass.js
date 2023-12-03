export default class GraphClass {
  constructor() {
    this.graph = {
      nodes: [],
      edges: [],
      nodeDegrees: {},
      movieImageLinks: [],
      deNiroNumbers: []
    };
    this.processCastNames();

    this.all_components = null;
    this.indexMap = null;
    this.hashval = null;
  }

  processCastNames() {
    this.graph.nodes.forEach(node => {
      if (node.cast_name) {
        node.cast_name = node.cast_name.split(',').map(name => name.trim());
      }
    });
  }

  genHash(){
    /*
    Taken from https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
    We might want to reuse computations if the graph hasn't changed.
    */
    let s = JSON.stringify(this.graph.nodes.map(n => n.id)) 
      + JSON.stringify(this.graph.edges.map(e => e.source.id + e.target.id));
    return s.split("").reduce(function(a, b) {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
  }
  
  // Problem 6a) Compute average node degree
  computeAverageNodeDegree() {
    let degVals = Object.values(this.graph.nodeDegrees);
    return degVals.reduce((acc, cur) => acc + cur) / degVals.length;
  }

  setIndexMap(){
    /*
    Preprocessing for the more advanced functions. 
    Maps node ids to indices in the graph.nodes array, 
    and converts the node-list/edge-list representation into 
    a adjacency list representation (for each node, there is a list of neighbors).
    */
    let indexMap = new Map();
    this.graph.nodes.forEach((v,i) => {
      v.neighbors = [];
      indexMap.set(v.id, i);
    });

    this.graph.edges.forEach(e => {
      let srcInd = indexMap.get(e.source);
      let tgtInd = indexMap.get(e.target);
      this.graph.nodes[srcInd].neighbors.push(tgtInd);
      this.graph.nodes[tgtInd].neighbors.push(srcInd);
    });      
    this.indexMap = indexMap;
    return indexMap;
  }

  // Problem 6b) Number of connected components
  computeConnectedComponents() {
    /*
    Computes the connected components of the graph using a basic traversal 
    algorithm; if there is a path from u-v, then u and v are in the same component.
    Stores the unordered components as an array of sets by node index (not id)
    and returns the length of this array (number of components).
    */
    this.setIndexMap();

    let visted = new Set();
    let traverse = v => {
      visted.add(v);
      let component = new Set();
      component.add(v);
      let Q = [v];

      while(Q.length > 0){
        let u = Q.pop();
        this.graph.nodes[u].neighbors.forEach(w => {
          if (! visted.has(w)){
            visted.add(w);
            component.add(w);
            Q.unshift(w);
          }
        });
      };
      return component;
    };

    let all_components = [];
    let cc = 0;
    this.graph.nodes.forEach((n,i) => {
      if(! visted.has(i)){
        cc += 1;
        let component = traverse(i);
        all_components.push(component);
      }
    });

    this.all_components = all_components;
    return cc;
  }

  // Problem 6c) Compute graph density
  computeGraphDensity() {
    let V = this.graph.nodes.length;
    let E = this.graph.edges.length;

    if(V <= 1){
      console.log("Density undefined");
      return 0;
    }

    return 2 * E / (V * (V-1));
  }

  computeLargestComponent(){
    if(! this.all_components){
      this.computeConnectedComponents();
    }
    this.all_components.sort((a,b) => b.size - a.size);
    return this.all_components[0];
  }

  extractLargestComponent(){
    /*
    Returns largest component as an object with a node-list + edge-list.
    */
    const component = this.computeLargestComponent();
    const indexMap = this.indexMap;

    let subNodes = this.graph.nodes.filter(n => component.has(indexMap.get(n.id)))
    let subEdges = this.graph.edges.filter(
      e => component.has(indexMap.get(e.source)) && component.has(indexMap.get(e.target))
    );

    return {
      "nodes": subNodes,
      "edges": subEdges
    };

  }

  findLargestConnectedComponent(){
    return this.extractLargestComponent();
  }    

  computeSSSP(s,nodes){
    /*
    Computes the single-source-shortest path array, arr
    s.t. arr[i] is the shortest path from parameter v_s to v_i.
    Uses a basic breadth-first-search (unweighted).
    Nodes that are not connected have distance -1 (undefined).
    */
    let Q = [s];
    let visited = new Set();
    visited.add(s);

    let dists = nodes.map(() => -1);
    dists[s] = 0;

    while(Q.length > 0){
      let u = Q.pop();
      nodes[u].neighbors.forEach(v => {
        if(! visited.has(v)){
          dists[v] = dists[u] + 1;
          visited.add(v);
          Q.unshift(v)
        }
      });
    }
    return dists;
  }

  computeAPSP(){
    /*
    Computes the all-pairs-shortest-path matrix A, 
    s.t. A[i][j] is the length of the shortest path from v_i to v_j.
    A bit expensive at O(n^2), so let's only recompute it if we 
    have to (i.e. the graph has changed).
    Since we just need this for the diameter, disconnected nodes are represented with 
    A[i][j] = -1.
    */
    this.hashval = this.genHash();
    const nodes = this.graph.nodes;
    // if(this.apsp && this.hashval === this.genHash()){
    //   return this.apsp;
    // }
    return this.apsp = nodes.map((n,i) => this.computeSSSP(i,nodes));
  }

  computeDiameter(){
    this.computeAPSP();
    return Math.max(...this.apsp.flat());
  }

  findGraphDiameter(){
    return this.computeDiameter();
  }


  
  computeAPL() {
    this.setIndexMap();

    // First, compute the all-pairs-shortest-path matrix.
    const APSPMatrix = this.computeAPSP();

    // Determine the largest connected component.
    const largestComponent = this.computeLargestComponent();

    let totalPathLength = 0;
    let count = 0;

    for (let i of largestComponent) {
      for (let j of largestComponent) {
        // Avoid self-loops.
        if (i !== j) {
          totalPathLength += APSPMatrix[i][j];
          count++;
        }
      }
    }

    // Compute and return the average path length for the largest connected component.
    return totalPathLength / count;
  }

  /*
    Problem 6) Compute the 'De Niro' number for each vertex in the graph and 
    store it as an attribute of the graph
  */
  computeDeNiroNumber() {
    const nodeIdToIndex = new Map();
    this.graph.nodes.forEach((node, index) => {
      nodeIdToIndex.set(node.id, index);
      node.de_niro = Infinity; 
      node.pathToDeNiro = []; 
    });

    const queue = this.graph.nodes.filter(node => node.cast_name.includes('Robert De Niro'))
                                  .map(node => {
                                      return { id: node.id, dist: 0, path: [node.id] };
                                  });

    queue.forEach(item => {
      this.graph.nodes[nodeIdToIndex.get(item.id)].de_niro = 0; 
      this.graph.nodes[nodeIdToIndex.get(item.id)].pathToDeNiro = [item.id]; 
    });

    while (queue.length > 0) {
      const { id, dist, path } = queue.shift();
      
      // Process all adjacent nodes
      this.graph.edges.forEach(edge => {
        if (edge.source === id || edge.target === id) {
          const adjacentId = edge.source === id ? edge.target : edge.source;
          const adjNode = this.graph.nodes[nodeIdToIndex.get(adjacentId)];
          if (adjNode.de_niro === Infinity) {
            adjNode.de_niro = dist + 1;
            adjNode.pathToDeNiro = [...path, adjacentId];
            queue.push({ id: adjacentId, dist: dist + 1, path: [...path, adjacentId] });
          }
        }
      });
    }

    // Handles unreachable nodes
    this.graph.nodes.forEach(node => {
      if (node.de_niro === Infinity) {
        node.de_niro = -1; 
        node.pathToDeNiro = [];
      }
    });

    this.graph.deNiroNumbers = this.graph.nodes.map(node => node.de_niro);
  }
  
}
