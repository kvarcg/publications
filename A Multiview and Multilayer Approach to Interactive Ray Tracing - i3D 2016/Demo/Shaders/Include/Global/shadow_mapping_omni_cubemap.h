#line 2
// Various Shadow mapping functions

// Normalization function of the point to light direction vector
// Parameters:
// point_to_light: the point to light direction vector
// Returns the normalized depth value for the current point
float getOmniZ(vec3 point_to_light)
{
	point_to_light = abs(point_to_light);
	float p_z = max(point_to_light.x, max(point_to_light.y, point_to_light.z));
	float far = uniform_light_far_range;
	float near = uniform_light_near_range;
	p_z = (far + near) / (far - near) - (2 * far * near) / (far - near) / p_z;
	// set scale of light space z vaule to [0, 1]
	p_z = 0.5 * p_z + 0.5;
	return p_z;
}

// Traditional shadow mapping (1 sample per pixel) with a constant bias
// Parameters:
// pwcs: the position in WCS
// Returns the shadow factor for the current point
float shadow_nearest(vec3 pwcs)
{
	vec3 p_direction = pwcs - uniform_light_position;
	//p_direction = normalize(p_direction);

	// sample shadow map
	float shadow_map_z = texture(sampler_shadow_map, p_direction).r;
	float p_z = getOmniZ(pwcs - uniform_light_position);

	// + shaded -> 0.0 
	// - lit -> 1.0
	return clamp(-sign((p_z - uniform_constant_bias) - shadow_map_z), 0.0, 1.0);
}

// PCF shadow mapping using a 4x4 gaussian kernal and constant bias
// Parameters:
// pwcs: the position in WCS
// Returns the shadow factor for the current point
float shadow_pcf_gaussian(vec3 pwcs)
{
	vec3 p_direction = pwcs - uniform_light_position;

	vec2 offset_jittering = 0.4 * texture(sampler_noise, 220 * (pwcs.xy - vec2(0.5, 0.5))).xy;
	float costheta = cos(offset_jittering.x * 6.28);
	float sintheta = sin(offset_jittering.x * 6.28);
	mat2 rotX = mat2(vec2(costheta, sintheta), vec2(-sintheta, costheta));

	// find tangent vectors
	vec3 u = cross(p_direction, vec3(0.0, 1.0, 0.0));
	if (dot(u, u) < 1.e-3f)
		u = cross(p_direction, vec3(1.0, 0.0, 0.0));
	u = normalize(u);
	vec3 v = cross(p_direction, -u);

	float far = uniform_light_far_range;
	float near = uniform_light_near_range;

	vec2 offset;
	float radius = uniform_light_size;
	float weight_total = 0.0;

	float res = 0.0;
	for (int i = 0; i < 16; i++)
	{
		vec2 _kernel = vec2(uniform_samples[i].xy);
		_kernel = rotX * _kernel;

		// shift the light direction
		p_direction = pwcs + uniform_light_size * (u*_kernel.x + v*_kernel.y) - uniform_light_position;

		// sample shadow map
		float shadow_map_z = texture(sampler_shadow_map, p_direction).r;
		float p_z = getOmniZ(p_direction);

		// constant depth bias
		res += (clamp(-sign(p_z - uniform_constant_bias - shadow_map_z), 0.0, 1.0));
		// slope _bias
		//float slope_bias = abs((texel_offset.x * d_anal_z_to_du_dv.x)) + abs((texel_offset.y * d_anal_z_to_du_dv.y)) + uniform_constant_bias;
		//res += (clamp(-sign(p_z - slope_bias - shadow_map_z), 0.0, 1.0));
		weight_total += 1.0;
	}
	return res / 16.0;
}


// Generic shadow mapping function
// Parameters:
// pecs: the eye space position
// Returns the shadow factor for the current point
float shadow(vec3 pecs)
{
	vec4 pwcs = uniform_view_inverse * vec4(pecs, 1);
	vec4 plcs = uniform_light_projection * uniform_light_view[0] * pwcs;
	plcs /= plcs.w;
	plcs.xy = (plcs.xy + 1) * 0.5;

	// set scale of shadow map value to [-1,1] or
	// set scale of light space z value to [0, 1]
	plcs.z = (plcs.z + 1) * 0.5;

	float shadowFactor = 1;

	//shadowFactor = shadow_nearest(pwcs.xyz);

	//shadowFactor = shadow_pcf_3x3(plcs.xyz);

	//shadowFactor = shadow_pcf_2x2_bilinear_interpolation(plcs.xyz);

	shadowFactor = shadow_pcf_gaussian(pwcs.xyz);

	return shadowFactor;
}