#include<iostream>
#include "grid.h"
#include "gcanvas.h"
#include "huffman.h"

using namespace std;

void loadJpeg(GCanvas& img, string filename) {
    // Your Code Here
    // GImage gim(filename);
    // Grid<int>grid(gim.getHeight(), gim.getWidth());
    // for (int r = 0; r < grid.numRows(); r++) {
    //     for (int c = 0; c < grid.numCols(); c++) {
    //         grid[r][c] = gim.getPixel(c, r);
    //     }
    // }
    Grid<int> grid;
    img.fromGrid(grid);
}
