#line 2
vec4 fragments[ABUFFER_LOCAL_SIZE];

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

void sort_shell(const int num)
{
	int inc = num >> 1;
	while (inc > 0)
	{
		for (int i = inc; i < num; ++i)
		{
			vec4 tmp = fragments[i];

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

void sort(const int num)
{
	if (num <= INSERT_VS_SHELL)
		sort_insert(num);
	else
		sort_shell(num);
}

int  setMaxFromGlobalArray(float Z)
{
	int  id;
	vec2 maxFR = vec2(-1.0f, 0.0f);

	for (int i = 0; i < ABUFFER_LOCAL_SIZE_1n; i++)
	{
		float Zi = fragments[i].g;
#if defined (PROJECTIVE_Z)
		if (maxFR.g < Zi)
#elif defined (CAMERA_Z)
		if (maxFR.g > Zi)
#endif
		{
			maxFR.r = i;
			maxFR.g = Zi;
		}
	}

#if defined (PROJECTIVE_Z)
	if (Z < maxFR.g)
#elif defined (CAMERA_Z)
	if (Z > maxFR.g)
#endif
	{
		id = int(maxFR.r);
		fragments[ABUFFER_LOCAL_SIZE_1n] = fragments[id];
	}
	else
		id = ABUFFER_LOCAL_SIZE_1n;

	return id;
}