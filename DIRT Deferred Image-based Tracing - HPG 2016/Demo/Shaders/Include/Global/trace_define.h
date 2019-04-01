#line 2
#define EPSILON 0.0000001

// These are used only for Trace Test
#define BINARY_SEARCH __BINARY_SEARCH__
#define ITERATIONS 20
#define RANDOM_PIXEL
//#define DEFERRED_AO

// Test within a random near far range on each iteration. This is a realistic scenario where only a portion of the list needs to be traversed. 

// Test by forcing rays to move towards the camera,  and expect the result on the far side of the scene. In this case, a bi-directional traversal
// should perform better, as the unidirectional traversal would need to iterate from the beginning towards the end of the list
//#define INVERSE_RAY_TEST
// Test by forcing rays to move away from the camera,  and expect the result anywhere on the scene. These should give roughly equal results
// in both traversal modes, since they perform the same operations (iterate from the beginning).
//#define FORWARD_RAY_TEST

#define BIDIRECTIONAL_RAY_TEST
#define UNIFORM_FRAG_DISTRIBUTION 0

// These are used both in Trace Test and actual tracing
//#define SINGLE_LAYER
#define EARLY_SKIP 1
#define USE_BUCKETS

#define invalid_result -1
#define THICKNESS __THICKNESS__
// if MAX_SAMPLES_PER_RAY is defined as -1 then CONSERVATIVE_MARCHING is defined instead of a number 
#define MAX_SAMPLES_PER_RAY __MAX_SAMPLES_PER_RAY__
#define NUM_LAYERS 1

#if MAX_SAMPLES_PER_RAY < 1
#define CONSERVATIVE_MARCHING
#endif

//#define SKIP_FIRST_FACE
//#define TRACE_HIZ_LINEAR
//#define WRITE_IMAGE_POSITIONS
#define invalid_lod -2 
//#define TRACE_HIZ_DEBUG
//#define STATISTICS
//#define TRACE_HIZ_DEBUG_STATISTICS
#define PIXEL_ANTIALIASING
	
//#define SKIP_FIRST_FACE
// for conservative rasterization
#define CONSERVATIVE __CONSERVATIVE__
#define NORMAL_MAPS
#define EMISSION_MULT 100.0
#define DEPTH_MASK

#define ACCENUATE_GI 1
//#define TEST_MISSING_PEEL_DATA
//#define SKIP_REMAINING_BUCKETS
#define NO_TRANSMISSION 0.0

// assign each bucket to near-far (this is slower)
//#define UNIFORM_BUCKETS

// Only for the deferred path tracer
#define ANALYTIC_TRACING
#define ACCURATE_BOUNDS