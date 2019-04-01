#line 2
const float pi = 3.1415936;
// implementation based on: lumina.sourceforge.net/Tutorials/Noise.html
// Fast random number generator
// Parameters:
// - seed, the generator's seed
// Returns a number in the range [0-1)
float rand1n(vec2 seed)
{
	highp vec3 abc = vec3(12.9898, 78.233, 43758.5453);
	highp float dt = dot(seed.xy, vec2(abc.x, abc.y));
	highp float sn = mod(dt, 2 * pi);
	return max(0.01, fract(sin(sn) * abc.z));
}

// Fast random number generator
// Parameters:
// - seed, the generator's seed
// Returns two numbers in the range [0-1)
vec2 rand2n(vec2 seed) {
	return vec2(rand1n(seed), rand1n(seed * vec2(11, 13)));
};

// Fast random number generator
// Parameters:
// - seed, the generator's seed
// Returns three numbers in the range [0-1)
vec3 rand3n(vec2 seed) {
	return vec3(rand1n(seed), rand1n(seed * vec2(11, 13)), rand1n(seed * vec2(19, 23)));
}

// Retrieves a random seed for screen-space passes based on UV coordinates
// Parameters:
// - unique, a unique vec2 number (e.g., texture coordinates in a screen-space pass)
// Returns a vec2 seed number
vec2 getSamplingSeed(vec2 unique)
{
	return unique.xy * 17;
}

// Retrieves a random seed for screen-space passes based on UV coordinates and an iteration number (e.g., the normalized increment in a for loop)
// Parameters:
// - unique, a unique vec2 number (e.g., texture coordinates in a screen-space pass)
// - iteration, an iteration number in the range [0->1)
// Returns a vec2 seed number
vec2 getSamplingSeedIteration(vec2 unique, float iteration)
{
	return unique.xy * 17 + iteration;
}
