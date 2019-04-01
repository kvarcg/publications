// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains implementation for sorting the fragments
// Shell sort is used for large lists (>=16)
// Insertion sort is used for smaller lists (<16)

#line 8

uint  fragments_id[ABUFFER_GLOBAL_SIZE];
float fragments_depth[ABUFFER_GLOBAL_SIZE];

#if SORT_SHELL
void sort_shell(const int num)
{
	int inc = num >> 1;
	while (inc > 0)
	{
		for (int i = inc; i < num; ++i)
		{
			float tmp_depth = fragments_depth[i];
			uint tmp_id	= fragments_id[i];
			int j = i;
			while (j >= inc && fragments_depth[j - inc] < tmp_depth)
			{
				fragments_id[j] = fragments_id[j - inc];
				fragments_depth[j] = fragments_depth[j - inc];
				j -= inc;
			}
			fragments_depth[j] = tmp_depth;
			fragments_id[j]	   = tmp_id;
		}
		inc = int(inc / 2.2f + 0.5f);
	}
}
#endif

#if SORT_INSERT
void sort_insert(const int num)
{
	for (int j = 1; j < num; ++j)
	{
		float key_depth = fragments_depth[j];
		uint  key_id	= fragments_id[j];
		//vec2 key = fragments[j];
		int i = j - 1;
#if defined (PROJECTIVE_Z)
		while (i >= 0 && fragments_depth[i] > key_depth)
#elif defined (CAMERA_Z)
		while (i >= 0 && fragments_depth[i] < key_depth)
#endif
		{
			fragments_depth[i+1] = fragments_depth[i];
			fragments_id[i+1]	 = fragments_id[i];
			--i;
		}
		fragments_id[i+1] = key_id;
		fragments_depth[i+1] = key_depth;
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
