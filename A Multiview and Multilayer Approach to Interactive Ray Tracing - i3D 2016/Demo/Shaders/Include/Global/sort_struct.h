#line 2
void sort_insert(const int num, const uint index)
{
	for (int j = 1; j < num; ++j)
	{
		vec2 key = fragments[j];
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

void sort_shell(const int num, const uint index)
{
	int inc = num >> 1;
	while (inc > 0)
	{
		for (int i = inc; i < num; ++i)
		{
			vec2 tmp = fragments[i];

			int j = i;
#if defined (PROJECTIVE_Z)
			while (j >= inc && fragments[j - inc].g > tmp.g)
#elif defined (CAMERA_Z)
			while (j >= inc && fragments[j - inc].g < tmp.g)
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

void sort(const int num, const uint index)
{
	if (num <= INSERT_VS_SHELL)
		sort_insert(num, index);
	else
		sort_shell(num, index);
}