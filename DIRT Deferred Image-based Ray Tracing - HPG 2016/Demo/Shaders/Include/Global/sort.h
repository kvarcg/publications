#line 2
// Sorting Algorithm			// Best		// Average		// Worst
#define SORT_SHELL			1	// n		// n(logn)^2	// n(logn)^2
#define SORT_MERGE			0	// n(logn)	// n(logn)		// n(logn)
#define SORT_INSERT			1	// n		// n^2			// n^2
#define SORT_SELECT			0	// n^2		// n^2			// n^2
#define SORT_BUBBLE			0	// n		// n^2			// n^2

#define INSERT_VS_SHELL		16

vec4 fragments[ABUFFER_SIZE];

#if SORT_SHELL
void sort_shell(const int num)
{
	int inc = num >> 1;
	while (inc > 0)
	{
		for (int i = inc; i < num; ++i)
		{
			vec4 tmp = fragments[i];

			int j = i;
			while (j >= inc && 
#if defined (PROJECTIVE_Z)
				fragments[j - inc].g > tmp.g)
#elif defined (CAMERA_Z)
				fragments[j - inc].g < tmp.g)
#endif					
			{
				fragments[j] = fragments[j - inc];
				j -= inc;
			}
			fragments[j] = tmp;
		}
		inc = int(inc / 2.2f + 0.5f);
	}
}
#endif

#if SORT_MERGE
vec2 leftArray[ABUFFER_SIZE_2d];

void merge(int steps, int a, int b, int c)
{
	int i;
	for (i = 0; i < steps; ++i)
		leftArray[i] = fragments[a+i];

	i = 0;
	int j = 0;
	for (int k = a; k < c; ++k)
	{
		if (b+j >= c || (i < steps && leftArray[i].g < fragments[b+j].g))
			fragments[k] = leftArray[i++];
		else
			fragments[k] = fragments[b+j++];
	}
}
void sort_merge(const int num)
{
	int n	  = num;
	int steps = 1;

	while (steps <= n)
	{
		int i = 0;
		while (i < n - steps)
		{
			merge(steps, i, i + steps, min(i + steps + steps, n));
			i += (steps << 1); 
		}
		steps = (steps << 1); 
	}
}
#endif

#if SORT_INSERT
void sort_insert(const int num)
{
	for (int j = 1; j < num; ++j)
	{
		vec4 key = fragments[j];
		int i = j - 1;
#if defined (PROJECTIVE_Z)
		while (i >= 0 && fragments[i].g > key.g)
#elif defined (CAMERA_Z)
		while (i >= 0 && fragments[i].g < key.g)
#endif
		{
			fragments[i+1] = fragments[i];
			--i;
		}
		fragments[i+1] = key;
	}
}
#endif

#if SORT_SELECT
	void sort_select(const int num)
{
	vec4 t;
	for (int j = 0; j < num-1; ++j)
	{
		int swap = j;
		for (int i = j+1; i < num; ++i)
		{
			if (fragments[swap].g > fragments[i].g)
				swap = i;
		}

		t				= fragments[swap];
		fragments[swap] = fragments[j];
		fragments[j]	= t;
	}
}
#endif

#if SORT_BUBBLE
	void sort_bubble(const int num)
	{
		vec2 c0,c1;

		for (int i = (num - 2); i >= 0; --i)
		{
			for (int j = 0; j <= i; ++j)
			{
				c0 = fragments[j  ];
				c1 = fragments[j+1];
				if (c0.g > c1.g)
				{
					fragments[j  ] = c1;
					fragments[j+1] = c0;
				}
			}
		}
	}
#endif

void sort(const int num)
{
	if (num <= INSERT_VS_SHELL)
		sort_insert(num);
	else
		sort_shell(num);
}
