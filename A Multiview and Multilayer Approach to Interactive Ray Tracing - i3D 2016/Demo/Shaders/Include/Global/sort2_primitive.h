#line 2
uvec2 fragments[ABUFFER_GLOBAL_SIZE];

#if SORT_SHELL
void sort_shell(const int num)
{
	int inc = num >> 1;
	while (inc > 0)
	{
		for (int i = inc; i < num; ++i)
		{
			uvec2 tmp = fragments[i];

			int j = i;
			while (j >= inc && fragments[j - inc].g > tmp.g)
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

#if SORT_INSERT
void sort_insert(const int num)
{
	for (int j = 1; j < num; ++j)
	{
		uvec2 key = fragments[j];
		int i = j - 1;
		while (i >= 0 && fragments[i].g > key.g)
		{
			fragments[i + 1] = fragments[i];
			--i;
		}
		fragments[i + 1] = key;
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

int removeDuplicates(const int num)
{
	int i = 1;
	int j = 0;

	while (i < num)
	{
		if (fragments[i].g != fragments[j].g)
		{
			j++;
			fragments[j] = fragments[i];
		}
		i++;
	}

	return j + 1;
}
