class GraphView{
    #nodeRadius = 5;
    #margin = {"top": 15, "bottom": 15, "left": 20, "right": 15};

    constructor(svgId,nodes,edges){
        this.svg = d3.select(svgId);
        this.width = this.svg.node().getBoundingClientRect().width;
        this.height = this.svg.node().getBoundingClientRect().height; 
        this.layer1 = this.svg.append("g");
        this.layer2 = this.layer1.append("g");               
        this.setGraph(nodes,edges);
        this.zoomLevel = d3.zoomIdentity;
        this.currentSource = null;
        this.currentTarget = null;
        this.tmpLine = null;
        this.layout = "fda";
        this.currentEditingNodeId = null;

        // keeps track of the nodes that the user wants to display
        this.selectedNodes = new Set();
    }


    setGraph(nodes,edges){
        /*
        Sets up the internal class graph structure (node-list + edge-list)
        and sets up a force-directed simulation. 
        d3.forceLink will automatically convert the "source" and "target" fields from id strings 
        to node objects.
        */

        // Need a deep copy so we don't modify the backend data.
        this.nodes = JSON.parse(JSON.stringify(nodes));
        this.edges = JSON.parse(JSON.stringify(edges));

        const repulsionStrength = -100;
        const repulsionDistance = 100 * this.#nodeRadius;

        const clusterForce = (alpha) => {
            const clusterStrength = 0.02; 
            this.nodes.forEach(node => {
                this.nodes.forEach(otherNode => {
                    if (node.cluster === otherNode.cluster && node.id !== otherNode.id) {
                        node.vx -= (node.x - otherNode.x) * clusterStrength * alpha;
                        node.vy -= (node.y - otherNode.y) * clusterStrength * alpha;
                    }
                });
            });
        };

        this.nodes.forEach(n => {
            n.rank = Number(n.rank);
            n.fx = null;
            n.fy = null;
            n.showText = false;
        });

        const collisionRadius = this.#nodeRadius + 5;

        if(this.sim)
            this.sim.on("tick", null);

        this.sim = d3.forceSimulation(this.nodes)
            .force("link", d3.forceLink(this.edges).id(n => n.id).distance(50)) // Increase link distance
            .force("repulse", d3.forceManyBody().strength(repulsionStrength).distanceMax(repulsionDistance))
            .force("center", d3.forceCenter(this.width / 2, this.height / 2))
            .force("collide", d3.forceCollide().radius(collisionRadius)) // Apply collision radius
            .force("cluster", clusterForce)
            .stop();

        this.calcDegree();
        this.sim.nodes(this.nodes)            
        this.layout = "fda";        
    }

    calcDegree(){
        this.nodes.forEach(n => n.degree = 0);
        this.edges.forEach(e => {
            e.source.degree ++;
            e.target.degree ++;
        });
    }

    showText() {    
        const labelType = document.getElementById("labelType").value;
        this.layer1.selectAll(".names")
        .data(this.nodes.filter(n => n.showText), n => n.id)
        .join(
            enter => enter.append("text")
                .attr("class", "names")
                .attr("x", n => n.x)
                .attr("y", n => n.y)
                .attr("text-anchor", "middle")
                .attr("font-size", 10)
                .text(d => d[labelType]),
            update => update.attr("x", n => n.x).attr("y", n => n.y),
            exit => exit.remove()
        );
    }

    addAllText(){
        this.nodes.forEach(n => n.showText = true);
        this.showText();
    }

    removeAllText(){
        this.nodes.forEach(n => n.showText = false);
        this.showText();
    }

    startSim(ystop){
        /*
        Initialized force-directed simulation, and sets the nodes/edges positions to update 
        at each tick (frame).
        */
        let ticked = () => {
            let xbound = x => Math.max(this.#nodeRadius, Math.min(this.width-this.#nodeRadius, x));
            let ybound = y => Math.max(this.#nodeRadius, Math.min(ystop-this.#nodeRadius, y))

            this.layer1.selectAll(".links")
                .attr("x1", e => e.source.x)
                .attr("y1", e => e.source.y)
                .attr("x2", e => e.target.x)
                .attr("y2", e => e.target.y);
            this.layer1.selectAll(".nodes")
                .attr("cx", n => n.x = xbound(n.x))
                .attr("cy", n => n.y = ybound(n.y));   
            this.showText();      
        }

        this.sim.on('tick', ticked);
        this.sim.restart();        
    }    

    draw(){
        const t = d3.transition().duration(750)        
        if(this.layout === "fda"){
            this.layer1.selectAll(".arcs").transition(t).remove();
            this.layer1.selectAll(".links")
                .data(this.edges, e => e.source.id + e.target.id)
                .join(
                    enter => 
                        enter.append("line")
                        .attr("class", "links")
                        .attr("x1", e => e.source.x)
                        .attr("y1", e => e.source.y)
                        .attr("x2", e => e.target.x)
                        .attr("y2", e => e.target.y)
                        .attr("stroke", "black")
                        .attr("opacity", 0.5)
                        .attr("transform", this.zoomLevel),
                    update => update, 
                    exit => exit.transition(t).attr("stroke-width", 1e-12).remove()
                );
        }else if(this.layout === "linear"){
            this.drawArcs();
        }

        this.deleteEdge();

        const colorScale = d3.scaleOrdinal()
                .domain([...new Set(this.nodes.map(node => node.cluster))])
                .range(["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", 
                "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"])

        this.layer1.selectAll(".nodes")
            .data(this.nodes, d => d.id)
            .join(
                enter => 
                    enter.append("circle")
                    .attr("class", "nodes")
                    .attr("cx", n => n.x)
                    .attr("cy", n => n.y)
                    .attr("r", this.#nodeRadius)
                    .attr("fill", d => colorScale(d.cluster))
                    .attr("stroke", "black")
                    .attr("transform", this.zoomLevel),
                update => 
                    this.layout === "fda" ? 
                        update.attr("fill", d => colorScale(d.cluster))
                        : 
                        update.transition(t)
                            .attr("cx", n => n.x)
                            .attr("cy", n => n.y)
                            .attr("fill", d => colorScale(d.cluster)), 
                            
                exit => exit.transition(t).attr("r", 1e-12).remove()
            ).raise();
            

        if(this.layout === "fda"){
            this.sim.nodes(this.nodes);
            this.sim.alpha(0.5);
            this.sim.restart();
        }
    }

    

    drawArcs(){
        /*
        Draws arcs for edges between vertices in linear layout. 
        Code modified from https://observablehq.com/@d3/arc-diagram
        */

        const t = d3.transition().duration(750);
        function arc(d) {
            const x1 = d.source.fx;
            const x2 = d.target.fx;
            const y  = d.source.y;
            const r = Math.abs(x2 - x1) / 1.5;
            return `M${x1},${y}A${r},${r} 0,0,${x1 > x2 ? 1 : 0} ${x2},${y}`;
        }

        this.layer1.selectAll(".arcs")
            .data(this.edges, e => e.source.id + e.target.id)
            .join(
                enter => 
                    enter.append("path")
                    .attr("class", "arcs")
                    .attr("fill", "none")
                    .attr("stroke-opacity", 0.6)
                    .attr("stroke-width", 1.5)                    
                    .attr("stroke", "grey")
                    .attr("opacity", 0.3)
                    .attr("d", arc), 
                update => update, 
                exit => exit.transition(t).attr("stroke-width", 1e-12).remove()
            )
    }  

    viewSubset() {
        console.log(this.selectedNodes);
        // Hide all nodes and edges not in the selectedNodes set
        this.nodes.forEach(node => {
            node.isHidden = !this.selectedNodes.has(node);
        });
        this.edges.forEach(edge => {
            edge.isHidden = true;
        });

        this.updateVisibility();
        this.draw();
    }

    addClickListener(){
        /*
        Handles the click functionality, which should add a node to the graph with default attributes. 
        */

        this.svg.on("click", e => {
            if(this.currentSource)
                return;

            let [x,y] = d3.pointer(e);
            this.nodes.push({
                'name' : "No Title",
                'id': this.nodes.length.toString(),
                'x': x,
                'y': y,
                'year': 2023,
                'small_img_link': null,
                'large_img_link': null,
                'de_niro': null,
                'cluster': 7
            });
            this.draw();
            this.addDragListener();
        });

        this.svg.on("dblclick", null);

        this.layer1.selectAll(".nodes")
        .on('dblclick', (event, d) => {
            if (this.selectedNodes.has(d)) {
                this.selectedNodes.delete(d);
                d3.select(event.currentTarget).classed("selected", false);
            } else {
                this.selectedNodes.add(d);
                d3.select(event.currentTarget).classed("selected", true);
            }           
        });

        this.layer1.selectAll(".nodes")
            .on("click", (event, d) => {
                this.addDragListener();

        });
            
        this.layer1.selectAll(".nodes")
            .on("contextmenu", (event, d) => {
                event.preventDefault();
                if (this.tmpLine) {
                    this.tmpLine.remove();
                    this.tmpLine = null;
                }
                this.currentSource = null;
                this.currentTarget = null;
                if (confirm("Are you sure you want to delete this node and its associated edges?")) {
                    // Remove the node from the array
                    this.nodes = this.nodes.filter(n => n.id !== d.id);

                    // Remove any edges associated with the node
                    this.edges = this.edges.filter(e => e.source.id !== d.id && e.target.id !== d.id);
                    this.draw();
                    
                    this.addDragListener();
                    this.addClickListener();
                    this.clearTempLine();                    
                    
                }
                else {
                    this.clearTempLine();
                    return;
                } 
            });
    }

    deleteEdge() {
        this.layer1.selectAll(".links")
            .on("mouseover", function() {
                d3.select(this).classed("edge-highlight", true); 
            })
            .on("mouseout", function() {
                d3.select(this).classed("edge-highlight", false);
            })
            .on("contextmenu", (event, d) => {
                event.preventDefault();
                
                // Confirm the deletion
                if (confirm("Do you want to delete this edge?")) {
                    // Remove the edge from the edges array
                    const index = this.edges.indexOf(d);
                    if (index > -1) {
                        this.edges.splice(index, 1);
                    }
                    
                    // Redraw the graph to reflect changes
                    this.draw();
                    
            
                }
            });
    }

    clearTempLine() {
        if (this.tmpLine) {
            this.tmpLine.remove();
            this.tmpLine = null;
        }
    }

    updateNode(oldId, newId, newName, newRank, newGenre, newCast, newDirector, newWriter) {
        const nodeIndex = this.nodes.findIndex(node => node.id === oldId);
        if (nodeIndex !== -1) {
          // Update node attributes
          this.nodes[nodeIndex].id = newId;
          this.nodes[nodeIndex].name = newName;
          this.nodes[nodeIndex].rank = newRank;
          this.nodes[nodeIndex].genre = newGenre;
          this.nodes[nodeIndex].cast_name = newCast;
          this.nodes[nodeIndex].director_name = newDirector;
          this.nodes[nodeIndex].writter_name = newWriter;
    
          // Update links that refer to the old ID
          this.edges.forEach(link => {
            if (link.source.id === oldId) link.source.id = newId;
            if (link.target.id === oldId) link.target.id = newId;
          });
    
          // Redraw the graph
          this.draw();
        } else {
          console.error('Node with the specified ID not found');
        }
    }

    highlightPath(node) {
        // Reset any existing highlights
        this.removeHighlight();
    
        if (!node.pathToDeNiro || node.pathToDeNiro.length === 0) {
            return;
        }
    
        // Highlight all nodes and edges in the path
        node.pathToDeNiro.forEach((nodeId, index) => {
            if (index < node.pathToDeNiro.length - 1) {
                const nextNodeId = node.pathToDeNiro[index + 1];
                // Highlight the edge
                this.layer1.selectAll('.links')
                    .filter(d => (d.source.id === nodeId && d.target.id === nextNodeId) || 
                                    (d.source.id === nextNodeId && d.target.id === nodeId))
                    .classed('path-highlight-edge', true);
            }
            // Highlight the node
            this.layer1.selectAll('.nodes')
                .filter(d => d.id === nodeId)
                .classed('path-highlight-node', true);
        });
    }
    

    addDragListener(){
        /*
        Handles the click and drag functionality which should activate on mousedown over a node, 
        and connect two nodes with an edge if mouseup occurs while over a second node.
        */
        var tthis = this;
        d3.select('body')
        
        this.layer1.selectAll(".nodes")
        
            .on("click", function(event, d) {
                tthis.highlightPath(d);

                tthis.currentEditingNodeId = d.id;
                this.currentEditingNodeId = d.id;
                
                document.getElementById('editNodeId').value = d.id;
                document.getElementById('editNodeName').value = d.name;
                document.getElementById('editNodeRank').value = d.rank;
                document.getElementById('editNodeGenre').value = d.genre;
                document.getElementById('editNodeDirector').value = d.director_name;
                document.getElementById('editNodeCast').value = d.cast_name;
                document.getElementById('editNodeWriter').value = d.writter_name;


                // Display the modal
                document.getElementById('editNodeModal').style.display = "block";
            })

            .on("mousedown", (e,d) => {
                this.svg.on(".zoom", null);
                this.svg.on("click", null); 

                d.fx = d.x;
                d.fy = d.y;

                let [x,y] = d3.pointer(e);

                this.currentSource = d;
                this.tmpLine = this.layer2.append("line")
                    // .attr("class", "links")
                    .attr("x1", this.currentSource.x)
                    .attr("y1", this.currentSource.y)
                    .attr("x2", x)
                    .attr("y2", y)
                    .attr("stroke", "black")
                    .attr("transform", this.zoomLevel);
            })
            .on("mouseover", function(e,d){
                if (tthis.currentSource) {
                    tthis.currentTarget = d;
                    d3.select(this).attr("fill", "red")
                        .attr("r", 10);
                }
                else {
                    d3.select(this).classed("node-highlight", true);
                    d3.selectAll(".links").filter(e => e.source.id === d.id || e.target.id === d.id)
                        .classed("link-highlight", true);
                    d3.selectAll(".arcs").filter(e => e.source.id === d.id || e.target.id === d.id)
                        .classed("link-highlight", true);                        
                }
                document.getElementById("name").innerHTML = d.name;
                document.getElementById("id").innerHTML = d.id;
                document.getElementById("rank").innerHTML = d.rank;
                document.getElementById("year").innerHTML = d.year;
                document.getElementById("imdb_rating").innerHTML = d.imdb_rating;
                document.getElementById("duration").innerHTML = d.duration;
                document.getElementById("genre").innerHTML = d.genre;
                document.getElementById("director_name").innerHTML = d.director_name;
                document.getElementById("deniro").innerHTML = d.de_niro;
                document.getElementById("cluster").innerHTML = d.cluster;
                if (d.small_img_link) {
                    document.getElementById('img_link').src = d.small_img_link;
                } else {
                    document.getElementById('img_link').alt = "No Movie Image";
                }

            })
            .on("mouseout", function(){
                const colorScale = d3.scaleOrdinal()
                .domain([...new Set(tthis.nodes.map(node => node.cluster))])
                .range(["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", 
                "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"])

                d3.select(this).attr("fill", d => colorScale(d.cluster)).attr("r", 5).classed("node-highlight", false);
                d3.selectAll(".links").classed("link-highlight", false);
                d3.selectAll(".arcs").classed("link-highlight", false);
                this.currentTarget = null;
                //document.getElementById("movie-name").innerHTML = null;
                document.getElementById("name").innerHTML = null;
                document.getElementById("id").innerHTML = null;
                document.getElementById("rank").innerHTML = null;
                document.getElementById("year").innerHTML = null;
                document.getElementById("imdb_rating").innerHTML = null;
                document.getElementById("duration").innerHTML = null;
                document.getElementById("genre").innerHTML = null;
                document.getElementById("director_name").innerHTML = null;
                document.getElementById("deniro").innerHTML = null;
                document.getElementById('img_link').src = "";
                document.getElementById('img_link').alt = "Movie Image";
                document.getElementById("cluster").innerHTML = null;
            });

        this.svg.on("mousemove", e => {
            if(this.currentSource){
                let [x,y] = d3.pointer(e);
                this.tmpLine
                    .attr("x2", x)
                    .attr("y2", y)
                    .attr("transform", this.zoomLevel)
            }
        });

        this.svg.on("mouseup", () => {
            this.layer2.selectAll("line").remove();

            if(this.currentTarget){

                if(this.currentSource === this.currentTarget){
                    alert("Self loops not allowed");
                    return;
                }
                
                let newEdge = {"source": this.currentSource, "target": this.currentTarget};
                this.edges.forEach(e => {
                    if (newEdge.source.id === e.source.id && newEdge.target.id === e.target.id){
                        alert("edge already exists");
                        return;
                    }else if(newEdge.target.id === e.source.id && newEdge.source.id === e.target.id){
                        alert("edge already exists");
                        return;
                    }
                });

                if(this.layout === "fda"){
                    this.currentSource.fx = null;
                    this.currentSource.fy = null;
                }

                this.edges.push(newEdge);
                d3.selectAll(".nodes").attr("fill", "lightblue").attr("r", 5);
                this.draw();
                
                setTimeout(() => this.addClickListener(), 200);
            }
            
            // this.rescale();
            this.currentSource = null;
            this.currentTarget = null;     
        })
    }

    // linearLayout(field){
    //     /*
    //     Computes a linear layout with respect to the (scalar valued) field parameter, which every node in the graph should have. 
    //     Currently, only defined for rank and year. 
    //     Makes use of d3.scale to adjust the x coordinates, and sets the y coordinate to height / 3 (To allow plenty of rooms for arcs underneath).
    //     If two nodes share a x coordinate, we use d3.forceCollision to force one of the nodes upwards (could be done more sophisticated, but we already build the class-wide simulation).
    //     */
    //     this.layout = "linear";
    //     this.sim.stop();

    //     let y = this.height / 3;
    //     let xextent = d3.extent(this.nodes, d => Number(d[field]))
    //     let xscale = d3.scaleLinear().domain(xextent).range([this.#margin.left, this.width-this.#margin.right]);

    //     this.layer1.selectAll(".links").remove();

    //     this.nodes.forEach(n => {
    //         n.x = n.fx = xscale(Number(n[field]));
    //         n.y = y;
    //     })


    //     this.draw();

    //     //Give enough time for the d3.transition() to take place (otherwise, jarring jump)
    //     setTimeout(() => {
    //         this.sim = d3.forceSimulation(this.nodes)
    //             .force("collide", d3.forceCollide(this.#nodeRadius))
    //             .force("y", d3.forceY(this.height / 2).strength(1e-2))

    //         this.startSim(y);
    //     },1000);

    // }

    linearLayout(field) {
        this.layout = "linear";
        this.sim.stop();
    
        // Sort nodes by cluster ID, then by the specified field
        this.nodes.sort((a, b) => {
            if (a.cluster === b.cluster) {
                return d3.ascending(a[field], b[field]);
            }
            return d3.ascending(a.cluster, b.cluster);
        });
    
        let y = this.height / 3;

        // Determine the x position based on the sorted order
        let xSpacing = (this.width - this.#margin.left - this.#margin.right) / this.nodes.length;
        this.nodes.forEach((n, index) => {
            n.fx = this.#margin.left + index * xSpacing;
            n.x = n.fx;
            n.y = this.height / 2; // Place all nodes at the same y position
        });

        this.layer1.selectAll(".links").remove();
        
        // Redraw the graph with the updated positions
        this.draw();
        
    }

    
    



    highlightNodes(subNodes){
        /*
        Highlights the set of nodes subNodes, and makes all others transparent. 
        Future proofed for groups of nodes (now only called via search).
        */
        this.removeHighlight();

        this.layer1.selectAll(".links")
            .classed("link-unfocused", e => !subNodes.includes(e.source) && !subNodes.includes(e.target));

        this.layer1.selectAll(".nodes").filter(n => !subNodes.includes(n))
            .classed("node-unfocused", true)
            .attr("r", this.#nodeRadius);

        this.layer1.selectAll(".nodes").filter(n => subNodes.includes(n))
            .classed("node-focused", true)
            .attr("r", 2 * this.#nodeRadius);
    }

    removeDeNiroHighlight() {
        this.layer1.selectAll(".links")
        .classed("path-highlight-edge", false);  // Reset edge highlight
        this.layer1.selectAll(".nodes")
        .classed("path-highlight-node", false);  // Reset node highlight
    }

    removeHighlight(){
        /*
        Removes all highlights from above function.
        */
        this.layer1.selectAll(".links")
            .classed("link-unfocused", false);
        this.layer1.selectAll(".nodes")
            .classed("node-unfocused", false)
            .classed("node-focused", false)
            .attr("r", this.#nodeRadius);

        this.layer1.selectAll('.highlighted').classed('highlighted', false);
    }

    putText(subNodes){
        /*
        Enables text for highlighted nodes subNodes. 
        Future proofed for groups of nodes (now only called via search).
        */        
        this.nodes.forEach(n => 
            n.showText = subNodes.includes(n) ? true : false
        );
        this.showText();
    }

    // Helper method to reset visibility
    resetVisibility() {
        this.reset();
        
        this.updateVisibility();
        this.draw();
    }

    reset() {
        this.nodes.forEach(node => {
            node.isHidden = false;
        });
        this.edges.forEach(edge => {
            edge.isHidden = false;
        });
    }

    // Helper method to update visibility
    updateVisibility() {
        this.layer1.selectAll(".nodes")
            .classed("hidden", node => node.isHidden);
        this.layer1.selectAll(".links")
            .classed("hidden", edge => edge.isHidden);
    }

    queryId(searchValue) {
        if (!searchValue.trim()) {
            this.resetVisibility(); 
            this.draw();
            return;
        }

        let matchingNodes = new Set(this.nodes.filter(node => {
            let genres = node.genre ? node.genre.split(',') : [];
            let directors = node.director_name ? node.director_name.split(',') : [];
            let writers = node.writter_name ? node.writter_name.split(',') : [];

            return genres.some(genre => genre.trim() === searchValue) || 
                   (node.year && node.year.toString() === searchValue) || (
                    Array.isArray(node.cast_name) && 
                    node.cast_name.some(name => name.trim() === searchValue)) || 
                    (node.rank && node.rank.toString() === searchValue) ||
                    (node.name && node.name.toString() === searchValue) ||
                    (node.id && node.id.toString() === searchValue) || 
                    directors.some(direcotr => direcotr.trim() === searchValue) ||
                    writers.some(writer => writer.trim() === searchValue);
        }));
    
        // Update visibility: Hide non-matching nodes and all edges
        this.nodes.forEach(node => {
            node.isHidden = !matchingNodes.has(node);
        });
        this.edges.forEach(edge => {
            edge.isHidden = true; 
        });

        this.updateVisibility();
        this.draw();
    }    
    
}