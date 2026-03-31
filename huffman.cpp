#include "bits.h"
#include "treenode.h"
#include "huffman.h"
#include "map.h"
#include "vector.h"
#include "priorityqueue.h"
#include "strlib.h"
#include "SimpleTest.h"  // IWYU pragma: keep (needed to quiet spurious warning)
using namespace std;

/**
 * Given a Queue<Bit> containing the compressed message bits and the encoding tree
 * used to encode those bits, decode the bits back to the original message text.
 *
 * You can assume that tree is a well-formed non-empty encoding tree and
 * messageBits queue contains a valid sequence of encoded bits.
 *
 * Your implementation may change the messageBits queue however you like. There
 * are no requirements about what it should look like after this function
 * returns. The encoding tree should be unchanged.
 *
 * TODO: Add any additional information to this comment that is necessary to describe
 * your implementation.
 */
string decodeText(EncodingTreeNode* root, Queue<Bit>& messageBits) {
    string decoded;
    EncodingTreeNode *cur = root;

    while (!messageBits.isEmpty()) {
        if (messageBits.dequeue() == 0) {
            cur = cur->zero;
        } else {
            cur = cur->one;
        }
        if (cur->isLeaf()) { // use member functions for safety/readability
            decoded += cur->getChar();
            cur = root;
        }
    }
    return decoded;
}

EncodingTreeNode* unflattenTree(Queue<Bit>& treeBits, Queue<char>& treeLeaves) {
    if (treeBits.dequeue() == 0) {
        return new EncodingTreeNode(treeLeaves.dequeue());
    } else {
        EncodingTreeNode* zero = unflattenTree(treeBits, treeLeaves);
        EncodingTreeNode* one  = unflattenTree(treeBits, treeLeaves);
        return new EncodingTreeNode (zero, one);
    }
}


/**
 * Decompress the given EncodedData and return the original text.
 *
 * You can assume the input data is well-formed and was created by a correct
 * implementation of compress.
 *
 * Your implementation may change the data parameter however you like. There
 * are no requirements about what it should look like after this function
 * returns.
 *
 * TODO: Add any additional information to this comment that is necessary to describe
 * your implementation.
 */
string decompress(EncodedData& data) {
    // unflatten will consume the two queues from EncodedData and re-construct tree
    EncodingTreeNode *root = unflattenTree(data.treeShape, data.treeLeaves);
    string result = decodeText(root, data.messageBits);
    deallocateTree(root); // don't need tree any more
    return result;
}


/**
 * Constructs an optimal Huffman coding tree for the given text, using
 * the algorithm described in lecture.
 *
 * Reports an error if the input text does not contain at least
 * two distinct characters.
 *
 * When assembling larger trees out of smaller ones, make sure to set the first
 * tree dequeued from the queue to be the zero subtree of the new tree and the
 * second tree as the one subtree.
 *
 * TODO: Add any additional information to this comment that is necessary to describe
 * your implementation.
 */
EncodingTreeNode* buildHuffmanTree(string text) {
    Map<char, int> counts;
    for (auto ch: text) {   // use map to count occurrences
        counts[ch]++;
    }
    if (counts.size() < 2) error("Input has too few distinct characters. Cannot apply Huffman coding.");

    PriorityQueue<EncodingTreeNode *> pq;
    for (auto ch: counts) { // load priority queue with leaf nodes, weight => frequency
        pq.enqueue(new EncodingTreeNode(ch), counts[ch]);
    }

    while (pq.size() > 1) { // loop until just one combined tree
        int weight = pq.peekPriority(); // dequeue two lowest frequency, combine into subtree, enqueue
        EncodingTreeNode *zero = pq.dequeue();
        weight += pq.peekPriority();
        EncodingTreeNode *one = pq.dequeue();
        pq.enqueue(new EncodingTreeNode(zero, one), weight);
    }
    return pq.dequeue();
}


/**
 * Given a string and an encoding tree, encode the text using the tree
 * and return a Queue<Bit> of the encoded bit sequence.
 *
 * You can assume tree is a valid non-empty encoding tree and contains an
 * encoding for every character in the text.
 *
 * TODO: Add any additional information to this comment that is necessary to describe
 * your implementation.
 */
void treeToEncodingMap(Map<char, string>& map, EncodingTreeNode* t, string path = "") {
    if (t) {
        if (t->isLeaf()) {
            map[t->getChar()] = path; // build map ch->encoding (as 0/1 string)
        } else {
            treeToEncodingMap(map, t->zero, path + '0');
            treeToEncodingMap(map, t->one,  path + '1');
        }
    }
}

Queue<Bit> encodeText(EncodingTreeNode* tree, string text) {
    Map<char, string> map;
    treeToEncodingMap(map, tree);
    Queue<Bit> q;
    for (auto ch: text)  {
        for (auto b : map[ch]) {
            q.enqueue(b == '1');
        }
    }
    return q;
}

void flattenTree(EncodingTreeNode* tree, Queue<Bit>& treeShape, Queue<char>& treeLeaves) {
    if (tree) {
        if (tree->isLeaf()) {
            treeShape.enqueue(0);
            treeLeaves.enqueue(tree->getChar());
        } else {
            treeShape.enqueue(1);
            flattenTree(tree->zero, treeShape, treeLeaves);
            flattenTree(tree->one,  treeShape, treeLeaves);
        }
    }
}


/**
 * Compress the input text using Huffman coding, producing as output
 * an EncodedData containing the encoded message and flattened
 * encoding tree used.
 *
 * Reports an error if the message text does not contain at least
 * two distinct characters.
 *
 * TODO: Add any additional information to this comment that is necessary to describe
 * your implementation.
 */
EncodedData compress(string messageText) {
    EncodingTreeNode* t = buildHuffmanTree(messageText);
    EncodedData data;
    data.messageBits = encodeText(t, messageText);
    flattenTree(t, data.treeShape, data.treeLeaves);
    deallocateTree(t);  // done with tree
    return data;
}


/* * * * * * Testing Helper Functions Below This Point * * * * * */

EncodingTreeNode* createExampleTree()
{
    /* Example encoding tree used in multiple test cases:
     *                *
     *              /   \
     *             T     *
     *                  / \
     *                 *   E
     *                / \
     *               R   S
     */
    EncodingTreeNode *r = new EncodingTreeNode('R');
    EncodingTreeNode *s = new EncodingTreeNode('S');
    EncodingTreeNode *root = new EncodingTreeNode(r, s);

    EncodingTreeNode *e = new EncodingTreeNode('E');
    root = new EncodingTreeNode(root, e);

    EncodingTreeNode *t = new EncodingTreeNode('T');
    root = new EncodingTreeNode(t, root);

    return root;
}


void deallocateTree(EncodingTreeNode* t) {
    if (t) {
        deallocateTree(t->zero);
        deallocateTree(t->one);
        delete t;
    }
}


bool areEqual(EncodingTreeNode* a, EncodingTreeNode* b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    if (a->isLeaf() && b->isLeaf()) {
        return a->getChar() == b->getChar();
    } else {
        return areEqual(a->zero, b->zero) && areEqual(b->one, a->one);
    }
}


/* * * * * * Test Cases Below This Point * * * * * */

/* TODO: Write your own student tests. */









/* * * * * Provided Tests Below This Point * * * * */

PROVIDED_TEST("decodeText, small example encoding tree") {
    EncodingTreeNode* tree = createExampleTree(); // see diagram above
    EXPECT(tree != nullptr);

    Queue<Bit> messageBits = { 1, 1 }; // E
    EXPECT_EQUAL(decodeText(tree, messageBits), "E");

    messageBits = { 1, 0, 1, 1, 1, 0 }; // SET
    EXPECT_EQUAL(decodeText(tree, messageBits), "SET");

    messageBits = { 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 1, 0, 1, 0, 1}; // STREETS
    EXPECT_EQUAL(decodeText(tree, messageBits), "STREETS");

    deallocateTree(tree);
}

PROVIDED_TEST("unflattenTree, small example encoding tree") {
    EncodingTreeNode* reference = createExampleTree(); // see diagram above
    Queue<Bit>  treeShape  = { 1, 0, 1, 1, 0, 0, 0 };
    Queue<char> treeLeaves = { 'T', 'R', 'S', 'E' };
    EncodingTreeNode* tree = unflattenTree(treeShape, treeLeaves);

    EXPECT(areEqual(tree, reference));

    deallocateTree(tree);
    deallocateTree(reference);
}

PROVIDED_TEST("decompress, small example input") {
    EncodedData data = {
        { 1, 0, 1, 1, 0, 0, 0 }, // treeShape
        { 'T', 'R', 'S', 'E' },  // treeLeaves
        { 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0, 1 } // messageBits
    };

    EXPECT_EQUAL(decompress(data), "TRESS");
}

PROVIDED_TEST("buildHuffmanTree, small example encoding tree") {
    EncodingTreeNode* reference = createExampleTree(); // see diagram above
    EncodingTreeNode* tree = buildHuffmanTree("STREETTEST");
    EXPECT(areEqual(tree, reference));

    deallocateTree(reference);
    deallocateTree(tree);
}

PROVIDED_TEST("encodeText, small example encoding tree") {
    EncodingTreeNode* reference = createExampleTree(); // see diagram above

    Queue<Bit> messageBits = { 1, 1 }; // E
    EXPECT_EQUAL(encodeText(reference, "E"), messageBits);

    messageBits = { 1, 0, 1, 1, 1, 0 }; // SET
    EXPECT_EQUAL(encodeText(reference, "SET"), messageBits);

    messageBits = { 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 1, 0, 1, 0, 1 }; // STREETS
    EXPECT_EQUAL(encodeText(reference, "STREETS"), messageBits);

    deallocateTree(reference);
}

PROVIDED_TEST("flattenTree, small example encoding tree") {
    EncodingTreeNode* reference = createExampleTree(); // see diagram above
    Queue<Bit>  expectedShape  = { 1, 0, 1, 1, 0, 0, 0 };
    Queue<char> expectedLeaves = { 'T', 'R', 'S', 'E' };

    Queue<Bit>  treeShape;
    Queue<char> treeLeaves;
    flattenTree(reference, treeShape, treeLeaves);

    EXPECT_EQUAL(treeShape,  expectedShape);
    EXPECT_EQUAL(treeLeaves, expectedLeaves);

    deallocateTree(reference);
}

PROVIDED_TEST("compress, small example input") {
    EncodedData data = compress("STREETTEST");
    Queue<Bit>  treeShape   = { 1, 0, 1, 1, 0, 0, 0 };
    Queue<char> treeChars   = { 'T', 'R', 'S', 'E' };
    Queue<Bit>  messageBits = { 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0 };

    EXPECT_EQUAL(data.treeShape, treeShape);
    EXPECT_EQUAL(data.treeLeaves, treeChars);
    EXPECT_EQUAL(data.messageBits, messageBits);
}

PROVIDED_TEST("Test end-to-end compress -> decompress") {
    Vector<string> inputs = {
        "HAPPY HIP HOP",
        "Nana Nana Nana Nana Nana Nana Nana Nana Batman",
        "Research is formalized curiosity. It is poking and prying with a purpose. – Zora Neale Hurston",
    };

    for (string input: inputs) {
        EncodedData data = compress(input);
        string output = decompress(data);

        EXPECT_EQUAL(input, output);
    }
}
