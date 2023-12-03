// import the GraphClass definiton from GraphClass.js
import GraphClass from './GraphClass.js'; 
var interactiveGraph;
/*
    Given some JSON data representing a graph, render it with D3
*/
// dummy commit
function renderGraph(graphData) {
    let graphView;
    if (! interactiveGraph) {
        graphObj.processCastNames();
        graphObj.computeDeNiroNumber();
        graphView = new GraphView("#svgGraph",graphData.nodes,graphData.edges);

        graphView.draw();
        graphView.startSim(graphView.height);
        graphView.addClickListener();
        graphView.addDragListener();
        graphView.showText();

        document.getElementById('editNodeSubmit').addEventListener('click', function(){
            const oldId = graphView.currentEditingNodeId;
            const newId = document.getElementById('editNodeId').value;
            const newName = document.getElementById('editNodeName').value;
            const newRank = document.getElementById('editNodeRank').value;
            const newGenre = document.getElementById('editNodeGenre').value;
            const newCast = document.getElementById('editNodeCast').value;
            const newDirector = document.getElementById('editNodeDirector').value;
            const newWriter = document.getElementById('editNodeWriter').value;
            graphView.updateNode(oldId, newId, newName, newRank, newGenre, newCast,
                newDirector, newWriter);
    

            document.getElementById('editNodeModal').style.display = "none";

            graphView.startSim(graphView.height);
            graphView.addClickListener();
            graphView.addDragListener();
            graphView.showText();
            //graphData.computeDeNiroNumber();
            
        });

        document.getElementById('editNodeCancel').addEventListener('click', function(){
            document.getElementById('editNodeModal').style.display = "none";
            graphView.draw();
            graphView.startSim(graphView.height);
            graphView.addClickListener();
            graphView.addDragListener();
            graphView.showText();
            graphView.removeDeNiroHighlight();
        }); 

        document.getElementById("labelType").addEventListener("change", function() {
            //console.log("Dropdown changed to:", document.getElementById('labelType').value);
            graphView.showText();
        });


    
        let nameButton = document.getElementById("showText");
        nameButton.textContent = "Show Labels";
        nameButton.value = 0;

        nameButton.addEventListener("click", () => {
            let val = Number(nameButton.value);
            if(val === 0) {
                graphView.addAllText();
                nameButton.textContent = "Hide Labels";

            } else {
                graphView.removeAllText();
                nameButton.textContent = "Show Labels";
            }
            nameButton.value ^= 1;
        });
    
        const searchButton = document.getElementById('search-button');
        const searchInput = document.getElementById('search-input');
        searchButton.addEventListener('click', () => {
            const inputValue = searchInput.value;
            graphView.queryId(inputValue);
        });
    
        const switchButton = document.getElementById('switchLayout');
        switchButton.addEventListener('click', () => {
            graphView.removeHighlight();
            if(graphView.layout === "fda")
                graphView.linearLayout("year");
            else{
                graphView.setGraph(graphView.nodes, graphView.edges.map(e => {
                  return {"source": e.source.id, "target": e.target.id}  
                }));
                graphView.draw();
                graphView.startSim(graphView.height);
                
            }
        });    
    
        interactiveGraph = graphView;        
    }
    else{ 
        graphView = interactiveGraph;
        graphView.setGraph(graphData.nodes, graphData.edges);
        graphView.draw();
        graphView.startSim(graphView.height);
    }
}

document.getElementById('saveGraph').addEventListener('click', () => {
    saveGraphToFile('new_output_graph.json');
});


function saveGraphToFile(filepath) {
    let graphData = {
        nodes: interactiveGraph.nodes.map(node => ({
            rank: node.rank,
            id: node.id,
            name: node.name,
            rank: node.rank,
            genre: node.genre,
            cast_name: node.cast_name,
            director_name: node.director_name,
            writter_name: node.writter_name,
            de_niro: node.de_niro
        })),
        edges: interactiveGraph.edges.map(edge => ({
            source: edge.source.id,
            target: edge.target.id
        }))
    }
    const newData = JSON.stringify(graphData, null, 2);
    var blob = new Blob([newData], {type: "application/json"});
    
    // Create a link element, use it to download the blob, and remove it
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filepath;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
}

/*
    Function to fetch the JSON data from output_graph.json & call the renderGraph() method
    to visualize this data
*/
function loadAndRenderGraph(fileName, linkFile, G, clusterFile) {

    clusterFile = "cluster_data.json";

    if(! G){
        G = new GraphClass();
    }
    fetch(fileName)
        .then(response => response.json())
        .then(jsonData => {

            jsonData.nodes.forEach(node => {
                node.de_niro = null; 
                node.pathToDeNiro = [];
            });

            G.graph.nodes = jsonData.nodes;
            G.graph.edges = jsonData.links;
            return fetch(linkFile);
        })

        .then(response => response.json())
        .then(movieImageData => {
            G.graph.movieImageLinks = movieImageData;

            G.graph.nodes.forEach(node => {
                const imgLinkData = G.graph.movieImageLinks.find(img => img.id === node.id);
                if (imgLinkData) {
                    node.small_img_link = imgLinkData.small_img_link;
                    node.large_img_link = imgLinkData.large_img_link;
                }
                else {
                    node.small_img_link = null;
                    node.large_img_link = null;
                }
            });
            
            return fetch(clusterFile);
        })

        .then(response => response.json())
        .then(clusterData => {
            const clusterMap = new Map(clusterData.map(item => [item.id, item.cluster_assignment]));

            G.graph.nodes.forEach(node => {
                node.cluster = clusterMap.get(node.id) || 0;
            });

            renderGraph(G.graph);
        })
        .catch(error => {
            console.error('Error during fetch operations:', error);
        });
}    

function passClientGraphToServer(){
    let indMap = new Map();
    graphObj.graph.nodes = interactiveGraph.nodes;
    graphObj.graph.edges = interactiveGraph.edges.map(e => {
        return {"source": e.source.id, "target": e.target.id}
    });

    graphObj.graph.nodes.forEach((n, i) => {
        n.degree = 0;
        indMap.set(n.id, i);
    });

    graphObj.graph.edges.forEach(e => {
        graphObj.graph.nodes[indMap.get(e.source)].degree ++;
        graphObj.graph.nodes[indMap.get(e.target)].degree ++;
    });

    let degs = {};
    graphObj.graph.nodes.forEach(n => {
        degs[n.id] = n.degree;
    });
    graphObj.graph.nodeDegrees = degs;
    return graphObj;
}

/*
    A method to compute simple statistics (Programming part Subproblem 6)
    on updated graph data
*/
function displayGraphStatistics(graphObj) {
    /*
    Computes the required graph statistics. Functionality for compute button is left, 
    we also check every second to see if the graph has changed (nodes/edges added or removed).
    If it has, we automatically update the stats (largely making button vestigial).
    */

    function computeStats(graph){
        let avgDeg = graph.computeAverageNodeDegree();
        let connectedComponent = graph.computeConnectedComponents();
        let density = graph.computeGraphDensity();
        let diameter = graph.computeDiameter();
        let apl = graph.computeAPL();
        //graphObj.processCastNames();
        graph.computeDeNiroNumber();

        document.getElementById("avgDegree").innerHTML = avgDeg;
        document.getElementById("numComponents").innerHTML = connectedComponent;
        document.getElementById("graphDensity").innerHTML = density;
        document.getElementById("diameter").innerHTML = diameter;
        document.getElementById("apl").innerHTML = apl;
    }

    let statButton = document.getElementById("computeStats");

    statButton.addEventListener("click", () => {
        if(interactiveGraph){
            let graphObj = passClientGraphToServer();
            computeStats(graphObj);
        }
    });

    setInterval(() => {
        let graphObj = passClientGraphToServer()
        let hash = graphObj.genHash();
        if (hash !== graphObj.hashval){
            graphObj.hashval = hash;
        }
    },1000)

}

function addExtractButton(){
    let button = document.getElementById("largestComp");
    button.value = 0;
    button.addEventListener("click", () => {
        let val = Number(button.value);
        if(interactiveGraph && val === 0){
            let graphObj = passClientGraphToServer();
            let subGraph = graphObj.extractLargestComponent();
            renderGraph(subGraph);
        }else if(interactiveGraph && val === 1){
            loadAndRenderGraph("output_graph.json", "movie-img_links.json", graphObj, "cluster_data.json");
        }
        button.value ^= 1;
    });
}

function addSubsetButton() {
    let button = document.getElementById('subset');
    button.value = 0;
    button.addEventListener("click", () => {
        let val = Number(button.value);
        if(interactiveGraph && val === 0){
            interactiveGraph.viewSubset();
            interactiveGraph.draw();
        }
        else if(interactiveGraph && val === 1){
            interactiveGraph.reset();
            interactiveGraph.updateVisibility();
            loadAndRenderGraph("output_graph.json", "movie-img_links.json", graphObj, "cluster_data.json");
        }
        button.value ^= 1;
    });
    
}


// instantiate an object of GraphClass
let graphObj = new GraphClass();

// your saved graph file from Homework 1
let fileName="output_graph.json";

let linkFile="movie-img_links.json";
let clusterFile = "cluster_data.json";

// render the graph in the browser
loadAndRenderGraph(fileName, linkFile, graphObj, clusterFile);


// compute and display simple statistics on the graph
displayGraphStatistics(graphObj);
addExtractButton();
addSubsetButton();
