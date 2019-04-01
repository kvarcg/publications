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

vec3 nearPlaneNormal = vec3(0, 0, -1);
vec3 farPlaneNormal = vec3(0, 0, 1);

#define VIEWPORT_NO_EXIT -1
#define VIEWPORT_EXIT_UP 0
#define VIEWPORT_EXIT_DOWN 1
#define VIEWPORT_EXIT_RIGHT 2
#define VIEWPORT_EXIT_LEFT 3
float clipViewport(vec2 P0, vec2 P1, vec4 viewport, out int viewport_exit)
{
	float alpha = 1.0;
	float tmp_alpha = 1.0;
	viewport_exit = VIEWPORT_NO_EXIT;

	if (P1.y > viewport.w)
	{
		tmp_alpha = (((P1.y > viewport.w) ? viewport.w : viewport.y) - P0.y) / (P1.y - P0.y);
		viewport_exit = VIEWPORT_EXIT_UP;
	}
	else if (P1.y < viewport.y)
	{
		tmp_alpha = (((P1.y > viewport.w) ? viewport.w : viewport.y) - P0.y) / (P1.y - P0.y);
		viewport_exit = VIEWPORT_EXIT_DOWN;
	}

	if (P1.x > viewport.z)
	{
		alpha = min(tmp_alpha, (((P1.x > viewport.z) ? viewport.z : viewport.x) - P0.x) / (P1.x - P0.x));
		viewport_exit = alpha < tmp_alpha ? VIEWPORT_EXIT_RIGHT : viewport_exit;
	}
	else if (P1.x < viewport.x)
	{
		alpha = min(tmp_alpha, (((P1.x > viewport.z) ? viewport.z : viewport.x) - P0.x) / (P1.x - P0.x));
		viewport_exit = alpha < tmp_alpha ? VIEWPORT_EXIT_LEFT : viewport_exit;
	}
	else
		alpha = tmp_alpha;

	return alpha;
}

void swap(in out float a, in out float b) {
	float temp = a;
	a = b;
	b = temp;
}

vec4 traceTest(ivec2 size)
{
	buffer_size = imageSize(image_test).xy;

	vec3 current_vertex_coords = vec3(gl_FragCoord.xy, 0);
	current_vertex_coords.z = getPixelHeadID(ivec3(gl_FragCoord.xy, 0));
	// get the ray origin and direction
	vec3 csOrigin = getVertexPosition(current_vertex_coords);
	vec3 csDirection = normalize(getVertexNormal(current_vertex_coords));

	// incoming view direction in ECS and WCS
	vec3 vertex_to_view_direction_ecs = -normalize(csOrigin);

	vec3 ref_dir = reflect(-vertex_to_view_direction_ecs, csDirection);
	// ray direction is set to perfect reflection direction
	csDirection = ref_dir;
	
	float jitter = 0;
	
	// clip with near and far plane
	// need to check also for ray parallel to planes to avoid dividing by near zero values (dot product ~= 0)
	vec2 denom = vec2(dot(csDirection, nearPlaneNormal), dot(csDirection, farPlaneNormal));

	float range = uniform_scene_length;
	float length_to_near = (denom.x != 0.0) ? -(dot(csOrigin, nearPlaneNormal) - uniform_near_far.x) / denom.x : range;
	length_to_near = (length_to_near < range && length_to_near > EPSILON) ? length_to_near : range;
	float length_to_far = (denom.y != 0.0) ? -(dot(csOrigin, farPlaneNormal) + uniform_near_far.y) / denom.y : range;
	length_to_far = (length_to_far < range && length_to_far > EPSILON) ? length_to_far : range;
	float clipped_length = min(length_to_near, length_to_far);
	vec3 csEndPoint = csDirection * clipped_length + csOrigin;

	// Project into screen space
	vec4 H0 = uniform_pixel_proj * vec4(csOrigin, 1.0);
	vec4 H1 = uniform_pixel_proj * vec4(csEndPoint, 1.0);
	float k0 = 1.0 / H0.w;
	float k1 = 1.0 / H1.w;

	// Switch the original points to values that interpolate linearly in 2D
	vec3 Q0 = csOrigin * k0;
	vec3 Q1 = csEndPoint * k1;

	// Screen-space endpoints
	vec2 P0 = H0.xy * k0;
	vec2 P1 = H1.xy * k1;

	// positive is away from the camera, negative towards
	int signdz = -int(sign(csEndPoint.z - csOrigin.z));

	// Initialize to off screen
	vec2 hitPixel = vec2(-1.0, -1.0);

	// Clipping to viewport	
	float offset = 0.5;
	vec4 viewport = vec4(offset, offset, buffer_size.x - offset, buffer_size.y - offset);
	int viewport_exit = VIEWPORT_NO_EXIT;
	float alpha = clipViewport(P0, P1, viewport, viewport_exit);

	P1 = mix(P0, P1, alpha); k1 = mix(k0, k1, alpha); Q1 = mix(Q0, Q1, alpha);
	vec4 start_points = vec4(P0, P1);

	vec2 delta = P1 - P0;

	// Permute so that the primary iteration is in x to reduce
	// large branches later
	bool permute = false;
	if (abs(delta.x) < abs(delta.y)) {
		// More-vertical line. Create a permutation that swaps x and y in the output
		permute = true;
		delta = delta.yx;
		P1 = P1.yx;
		P0 = P0.yx;
	}

	// From now on, "x" is the primary iteration direction and "y" is the secondary one
	float stepDirection = sign(delta.x);
	float invdx = stepDirection / delta.x;
	vec2 dP = vec2(stepDirection, invdx * delta.y);

	// Track the derivatives of Q and k
	vec3 dQ = (Q1 - Q0) * invdx;
	float dk = (k1 - k0) * invdx;

	// offset the start position
	P0 += dP * jitter; Q0 += dQ * jitter; k0 += dk * jitter;
	delta = P1 - P0;

	float stride = 1.0;	
	float stepCount = 0.0;
	float pixel_offset = 0.5;
	float prevZMaxEstimate = (Q0.z) / (dk * pixel_offset + k0);
	float rayZMax = prevZMaxEstimate;
	float rayZMin = prevZMaxEstimate;

	// P1.x is never modified after this point, so pre-scale it by 
	// the step direction for a signed comparison
	float end = P1.x * stepDirection;

	// Slide P from P0 to P1, (now-homogeneous) Q from Q0 to Q1, and k from k0 to k1
	// and move the first intersection to the next pixel instead of the current one
	pixel_offset = 0.5;
	vec2 P = P0 + dP * pixel_offset;
	vec3 Q = Q0 + dQ * pixel_offset;
	float k = k0 + dk * pixel_offset;

	// From now on, linearly iterate at each pixel and check for intersection with the abuffer
	// at each iteration, increase P, Q and k accordingly
	// dP, dQ and dk are the corresponding delta movements of the P,Q,k variables for each pixel
	int layer = -1;
	for (; P.x * stepDirection <= end && layer < 0 && rayZMax < 0; P += dP, Q += dQ, k += dk, stepCount++)
	{
		hitPixel.xy = permute ? P.yx : P;

		rayZMin = prevZMaxEstimate;

		// Compute the value at 1/2 pixel into the future
		rayZMax = (Q.z) / (dk * 0.5 + k);

		// verification check
		// if during traversal towards the far plane we exit it (therefore the z sign is flipped)
		// simply replace the value with the far plane value for comparison
		if (signdz > 0 && rayZMax >= 0)
			rayZMax = -uniform_near_far.y;

		prevZMaxEstimate = rayZMax;

		if (rayZMin > rayZMax)
			swap(rayZMin, rayZMax);

		layer = ray_hit_a_buffer_search(ivec2(hitPixel), rayZMin, rayZMax, signdz);
		// just write the ray points to the ray texture
		if (isDebugFragment())
			imageStore(image_preview, ivec3(hitPixel.xy, 1), vec4(0.05, 0.05, 0, 1));
#ifdef NO_HIT
		if (layer > -1) layer = -1;
#endif // NO_HIT

#ifdef NO_HIT
		layer = invalid_result;
#endif
	}
	// just write the ray points to the ray texture
	if (isDebugFragment())
	{
		imageStore(image_preview, ivec3(start_points.xy, 1), vec4(1, 0, 0, 1));
		imageStore(image_preview, ivec3(start_points.zw, 1), vec4(0, 1, 0, 1));
	}

	// result value
	vec4	fetched_value = vec4(0);

	if (layer > -1)
	{
		fetched_value = FetchResult(ivec3(hitPixel, layer));
	}
	return fetched_value;
}