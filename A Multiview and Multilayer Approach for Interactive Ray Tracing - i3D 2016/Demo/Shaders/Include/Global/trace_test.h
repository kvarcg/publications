#line 2
const float pi = 3.1415936;

float rand1_sin(vec2 seed)
{
    highp vec3 abc = vec3(12.9898, 78.233, 43758.5453);
    highp float dt= dot(seed.xy, vec2(abc.x,abc.y));
    highp float sn= mod(dt, 2*pi);
    return max(0.01, fract(sin(sn) * abc.z));
}

float rand1_cos(vec2 seed)
{
    highp vec3 abc = vec3(4.898, 7.233, 23421.631);
    highp float dt= dot(seed.xy, vec2(abc.x,abc.y));
    highp float sn= mod(dt, 2*pi);
    return max(0.01, fract(cos(sn) * abc.z));
}

vec2	rand2n	 (vec2 seed)
{
	vec2 rnd = vec2(rand1_sin(seed), rand1_cos(seed));
	return rnd.xy;
};

vec3	rand3n	 (vec2 seed)
{
	return vec3(rand1_sin(seed),
		rand1_cos(seed),
		rand1_sin(seed * 0.17));
}

// perform a ray test by randomly generating:
// - sampling coordinates (the coord parameter)
// - ray distance withing each coordinate (the minZ, maxZ parameters)
// - random ray direction (the increment parameter)
// the random ray direction is mainly to test the effectiveness of the double linked list implementations
// the far frustum value used here has been adjusted to 
// correspond to the scene's farthest distance as viewed from the current camera position
// rather than the parameters passed during camera initialization
// For each iteration, a search is performed within 
// a random coordinate, a random Z range within the near-far boundaries (only for the random range test) and a random ray direction

int iter = 0;
uniform vec2 uniform_near_far;
vec4 traceTest(ivec2 size)
{
	vec2	texcoords = vec2(gl_FragCoord.xy) / vec2(size);
	ivec2	coords = ivec2(gl_FragCoord.xy);
	float	far = -uniform_near_far.y;
	float	near = -uniform_near_far.x;
	float	near_far_dist = abs(far - near);
	int		increment = -1;
	int		id = -1;
	vec3	r = vec3(0);
	vec4	fetched_value = vec4(0);
	
#ifdef TEST_FULL_RANGE
	float maxZ = near;
	float minZ = far;
#endif // TEST_FULL_RANGE
	//vec2 testres;
	//int iter = 0;
	for (int index2 = 1; index2 <= ITERATIONS; index2++)
	{
#ifdef RANDOM_PIXEL
		vec2 seed = vec2(texcoords * vec2(index2 * 17)) ;
		r = rand3n(seed);
		r = max(r, vec3(0.01));
		// random coordinate
		coords = ivec2(vec2(r.xy) * vec2(size));
#endif // RANDOM_PIXEL

		vec3 r2 = rand3n(coords);
#ifdef INVERSE_RAY_TEST
		r2.x = 0.5;
		r2.y = 1.0;
		increment = -1;
#endif // INVERSE_RAY_TEST
#ifdef FORWARD_RAY_TEST
		increment = 1;
#endif // FORWARD_RAY_TEST
#ifdef BIDIRECTIONAL_RAY_TEST
		// random direction
		increment = (r.z > 0.5) ? -1 : 1;
#endif
		// random depth range
		float maxZ = r2.x * -near_far_dist + near;
		float minZ = maxZ - r2.y * abs(maxZ - far);
		// just store the result of the first hit - only for verification purposes
		id = ray_hit_a_buffer_search(coords, minZ, maxZ, increment);
		if (id > -1)
		{
			fetched_value += FetchResult(ivec3(coords, id));
		}
	}
	
	fetched_value /= float(ITERATIONS);
	return fetched_value;
}