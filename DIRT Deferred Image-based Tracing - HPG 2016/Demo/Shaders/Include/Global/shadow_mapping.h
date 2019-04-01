#line 2
// Various Shadow mapping functions

// Initializes the parameters for the adaptive depth bias
// Parameters:
// plcs: the position in [0-1) range in light post-projective coordinates
vec2 d_anal_z_to_du_dv;
void initSlopeBias(vec3 plcs)
{
	// take derivatives on 2x2 block of pixels
	// derivative of distance to light source with respect to screen x,y
	float d_anal_z_to_dx = dFdx(plcs.z);
	float d_anal_z_to_dy = dFdy(plcs.z);
	// derivative of texture u coordinate with respect to screen x,y
	float d_u_to_dx = dFdx(plcs.x);
	float d_u_to_dy = dFdy(plcs.x);
	// derivative of texture v coordinate with respect to screen x,y
	float d_v_to_dx = dFdx(plcs.y);
	float d_v_to_dy = dFdy(plcs.y);

	// build jacobian matrix
	mat2 jac = mat2(d_u_to_dx, d_v_to_dx, d_u_to_dy, d_v_to_dy);
	mat2 jac_inv_tr = inverse(transpose(jac));

	float invDet = 1 / (0.2 + (d_u_to_dx * d_v_to_dy) - (d_u_to_dy * d_v_to_dx));
	//Top row of 2x2
	vec2 ddist_duv;
	ddist_duv.x = d_v_to_dy * d_anal_z_to_dx; // invJtrans[0][0] * ddist_dx
	ddist_duv.x -= d_v_to_dx * d_anal_z_to_dy; // invJtrans[0][1] * ddist_dy
											   //Bottom row of 2x2
	ddist_duv.y = d_u_to_dx * d_anal_z_to_dx;   // invJtrans[1][1] * ddist_dy
	ddist_duv.y -= d_u_to_dy * d_anal_z_to_dy;  // invJtrans[1][0] * ddist_dx
	ddist_duv *= invDet;

	// derivative of distance to light source with respect to texture coordinates
	d_anal_z_to_du_dv = ddist_duv;
}

// Traditional shadow mapping (1 sample per pixel) with a constant bias
// Parameters:
// plcs: the position in [0-1) range in light post-projective coordinates
// Returns the shadow factor for the current point
float shadow_nearest(vec3 plcs)
{
	// sample shadow map
	float shadow_map_z = texture(sampler_shadow_map, plcs.xy).r;

	//if (light_space_z - uniform_constant_bias > shadow_map_z) return 0.0;
	//else return 1.0;

	// + shaded -> 0.0 
	// - lit -> 1.0
	return clamp(-sign((plcs.z - uniform_constant_bias) - shadow_map_z), 0.0, 1.0);
}

// PCF shadow mapping (using a 2x2 fixed kernel) with a constant bias
// and bilinear interpolation within the samples
// Parameters:
// plcs: the position in [0-1) range in light post-projective coordinates
// Returns the shadow factor for the current point
// TODO: check this
float shadow_pcf_2x2_bilinear_interpolation(vec3 plcs)
{
	float shadow_map_step = 1.5 / uniform_shadow_map_resolution;
	vec2 t = fract(uniform_shadow_map_resolution * plcs.xy + vec2(0.5, 0.5));
	float shadow_map_z;
	float test = 0.0;
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(shadow_map_step, shadow_map_step)).r;
	test = (t.x)*(t.y)*clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(-shadow_map_step, shadow_map_step)).r;
	test += (1 - t.x)*(t.y)*clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(-shadow_map_step, -shadow_map_step)).r;
	test += (1 - t.x)*(1 - t.y)*clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(shadow_map_step, -shadow_map_step)).r;
	test += (t.x)*(1 - t.y)*clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	return test;
}

// PCF shadow mapping (using a 3x3 fixed kernel) with a constant bias
// Parameters:
// plcs: the position in light post-projective coordinates
// Returns the shadow factor for the current point
float shadow_pcf_3x3(vec3 plcs)
{
	// + shaded -> 0.0 
	// - lit -> 1.0
	float shadow_map_step = 1.5 / uniform_shadow_map_resolution;
	float sum = 0.0;
	// the center
	float shadow_map_z = texture(sampler_shadow_map, plcs.xy).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [-1, +1]
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(-shadow_map_step, +shadow_map_step)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [0, +1]
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(0.0, +shadow_map_step)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [+1, -1]
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(+shadow_map_step, +shadow_map_step)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [-1, 0]
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(-shadow_map_step, 0.0)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [+1, 0]
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(+shadow_map_step, 0.0)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [-1, -1]
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(-shadow_map_step, -shadow_map_step)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [0, -1]
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(0.0, -shadow_map_step)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [+1, +1]
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(+shadow_map_step, +shadow_map_step)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);

	sum = sum / 9.0;
	return sum;
}

// PCF shadow mapping using a 4x4 gaussian kernal and adaptive bias
// Parameters:
// plcs: the position in [0-1) range in light post-projective coordinates
// Returns the shadow factor for the current point
float shadow_pcf_gaussian(vec3 plcs)
{
	float shadow_map_z = texture(sampler_shadow_map, plcs.xy).r;

	//	float radius = 0.5 + 30.5 * abs((plcs_ecs.z - plcs_sample_ecs.z) / plcs_ecs.z);
	//radius = 1 + light_size * ((plcs.z - shadow_map_z)/plcs.z);

	float radius = uniform_light_size;
	float sum_radius = 0.0;

	vec4 plcs_ecs = uniform_light_projection_inverse * vec4(2.0 * plcs - 1.0, 1.0);
	plcs_ecs /= plcs_ecs.w;

	for (int i = 0; i < 16; i++)
	{
		vec2 _kernel = radius * vec2(uniform_samples[i].xy);
		vec2 texel_offset = (0.1 + shadow_map_z)*10.0*_kernel / float(uniform_shadow_map_resolution);
		float shadow_map_z = texture(sampler_shadow_map, plcs.xy + texel_offset).r;
		vec4 plcs_sample_ecs = uniform_light_projection_inverse * vec4(2.0 * plcs.xy - 1.0, 2.0 * shadow_map_z - 1.0, 1.0);
		plcs_sample_ecs /= plcs_sample_ecs.w;

		sum_radius = max(sum_radius, 10 * abs((plcs_ecs.z - plcs_sample_ecs.z) / plcs_ecs.z));
	}

	sum_radius *= radius;
	radius = max(sum_radius, 1.0);

	//return radius / 50.0;

	vec2 offset;
	int i = 0;

	vec2 offset_jittering = 0.4 * texture(sampler_noise, 220 * (plcs.xy - vec2(0.5, 0.5))).xy;
	float costheta = cos(offset_jittering.x * 6.28);
	float sintheta = sin(offset_jittering.x * 6.28);
	mat2 rotX = mat2(vec2(costheta, sintheta), vec2(-sintheta, costheta));

	float weight_total = 0.0;

	float res = 0;//clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);	

	for (i = 0; i < 16; i++)
	{
		vec2 _kernel = vec2(uniform_samples[i].xy);
		_kernel = rotX * _kernel;
		//float dist = length(_kernel);
		float weight = 1;//exp(dist * dist);
		offset = 1 * radius * (_kernel + offset_jittering);
		vec2 texel_offset = offset / float(uniform_shadow_map_resolution);
		float shadow_map_z = texture(sampler_shadow_map, plcs.xy + texel_offset).r;
		// constant depth bias
		//res += (clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z),0.0,1.0) * weight);
		// slope _bias
		float slope_bias = abs((texel_offset.x * d_anal_z_to_du_dv.x)) + abs((texel_offset.y * d_anal_z_to_du_dv.y)) + uniform_constant_bias;
		res += (clamp(-sign(plcs.z - slope_bias - shadow_map_z), 0.0, 1.0) * weight);
		weight_total += weight;
	}
	res /= weight_total;

	//if (res > 15/16.0) res = 1.0;

	return res;
}

// Generic shadow mapping function
// Parameters:
// pecs: the eye space position
// Returns the shadow factor for the current point
float shadow(vec3 pecs)
{
	vec4 pwcs = uniform_view_inverse * vec4(pecs, 1);
	vec4 plcs = uniform_light_projection * uniform_light_view * pwcs;
	plcs /= plcs.w;
	plcs.xy = (plcs.xy + 1) * 0.5;

	// check that we are inside light clipping frustum
	//if (plcs.x < 0.0) return 0.0; if (plcs.y < 0.0) return 0.0; if (plcs.x > 1.0) return 0.0; if (plcs.y > 1.0) return 0.0;
	if ((clamp(plcs.xy, vec2(0, 0), vec2(1, 1)) - plcs.xy) != vec2(0, 0)) return 0.0;

	// set scale of shadow map value to [-1,1] or
	// set scale of light space z value to [0, 1]
	plcs.z = (plcs.z + 1) * 0.5;

	initSlopeBias(plcs.xyz);

	float shadowFactor = 1;

	//shadowFactor = shadow_nearest(plcs.xyz);

	shadowFactor = shadow_pcf_gaussian(plcs.xyz);

	return shadowFactor;
}

// Generic shadow mapping function
// Parameters:
// pwcs: the world space position
// Returns the shadow factor for the current point
float shadowWCS(vec3 pwcs)
{
	vec4 plcs = uniform_light_projection * uniform_light_view * vec4(pwcs, 1);
	plcs /= plcs.w;
	plcs.xy = (plcs.xy + 1) * 0.5;

	// check that we are inside light clipping frustum
	//if (plcs.x < 0.0) return 0.0; if (plcs.y < 0.0) return 0.0; if (plcs.x > 1.0) return 0.0; if (plcs.y > 1.0) return 0.0;
	if ((clamp(plcs.xy, vec2(0, 0), vec2(1, 1)) - plcs.xy) != vec2(0, 0)) return 0.0;

	// set scale of shadow map value to [-1,1] or
	// set scale of light space z value to [0, 1]
	plcs.z = (plcs.z + 1) * 0.5;

	initSlopeBias(plcs.xyz);

	float shadowFactor = 1;

	//shadowFactor = shadow_nearest(plcs.xyz);

	shadowFactor = shadow_pcf_gaussian(plcs.xyz);

	return shadowFactor;
}