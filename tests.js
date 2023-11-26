import { expect } from 'chai';
import { describe, it } from 'mocha';
import GraphClass from './GraphClass.js';

// some dummy graph data
const dummyGraphData = {
    "nodes": [
        { "id": "tt00001", "cast_name": "Robert De Niro, Al Pacino, Joe Pesci" },
        { "id": "tt00002", "cast_name": "Meryl Streep, Anne Hathaway, Emily Blunt" },
        { "id": "tt00003", "cast_name": "Denzel Washington, Ethan Hawke, Chris Pratt" },
        { "id": "tt00004", "cast_name": "Robert De Niro, Leonardo DiCaprio, Brad Pitt" },
        { "id": "tt00005", "cast_name": "Natalie Portman, Scarlett Johansson, Keira Knightley" },
        { "id": "tt00006", "cast_name": "Tom Hanks, Tim Allen, Robin Wright" }
    ],
    "edges": [
        { "source": "tt00001", "target": "tt00002" },
        { "source": "tt00002", "target": "tt00003" },
        { "source": "tt00003", "target": "tt00004" },
        { "source": "tt00004", "target": "tt00005" },
        { "source": "tt00005", "target": "tt00006" }
    ],
    "nodeDegrees": {
        "tt00001": 1,
        "tt00002": 2,
        "tt00003": 2,
        "tt00004": 2,
        "tt00005": 2,
        "tt00006": 1
    }
  }
  

describe('GraphClass', function() {
    describe('#computeDeNiroNumber()', function() {
        it('should compute the correct \'De Niro\' number for the each vertex in the dummy graph data', function() {
            let graphInstance = new GraphClass();
            graphInstance.graph = dummyGraphData;
            graphInstance.computeDeNiroNumber();
            expect(graphInstance.graph.deNiroNumbers).to.deep.equal([0, 1, 1, 0, 1, 2]);
        });
    });

});

