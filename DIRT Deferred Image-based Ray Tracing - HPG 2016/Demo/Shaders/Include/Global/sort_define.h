#line 2
// Sorting Algorithm			// Best		// Average		// Worst
#define SORT_SHELL			1	// n		// n(logn)^2	// n(logn)^2
#define SORT_MERGE			0	// n(logn)	// n(logn)		// n(logn)
#define SORT_INSERT			1	// n		// n^2			// n^2
#define SORT_SELECT			0	// n^2		// n^2			// n^2
#define SORT_BUBBLE			0	// n		// n^2			// n^2

#define ABUFFER_GLOBAL_SIZE		__ABUFFER_GLOBAL_SIZE__
#define ABUFFER_GLOBAL_SIZE_1n	ABUFFER_GLOBAL_SIZE  - 1
#define ABUFFER_GLOBAL_SIZE_2d	ABUFFER_GLOBAL_SIZE >> 1

#define ABUFFER_LOCAL_SIZE		__ABUFFER_LOCAL_SIZE__	
#define ABUFFER_LOCAL_SIZE_1n	ABUFFER_LOCAL_SIZE  - 1
#define ABUFFER_LOCAL_SIZE_2d	ABUFFER_LOCAL_SIZE >> 1

#define KBUFFER_SIZE			__ABUFFER_LOCAL_SIZE__
#define KBUFFER_SIZE_1n			KBUFFER_SIZE - 1

#define INSERT_VS_SHELL			__SORTING_METHOD_SIZE__

#define SORTING_GLOBAL			0 //use ABUFFER_GLOBAL_SIZE max{#fr/pixel}
//#define SORTING_LOCAL_INS		1 //use ABUFFER_LOCAL_SIZE <= 8
//#define SORTING_LOCAL_MAX		2 //use ABUFFER_LOCAL_SIZE <= 32