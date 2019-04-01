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
	//d_anal_z_to_du_dv = jac_inv_tr * vec2(d_anal_z_to_dx, d_anal_z_to_dy);
}

// Traditional shadow mapping (1 sample per pixel) with a constant bias
// Parameters:
// plcs: the position in [0-1) range in light post-projective coordinates
// slice: the cascade index
// Returns the shadow factor for the current point
float shadow_nearest(vec3 plcs, int slice)
{
	// sample shadow map
	float shadow_map_z = texture(sampler_shadow_map, vec3(plcs.xy, slice)).r;

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
// slice: the cascade index
// Returns the shadow factor for the current point
// TODO: check this
float shadow_pcf_2x2_bilinear_interpolation(vec3 plcs, int slice)
{
	float shadow_map_step = 0.5 / uniform_shadow_map_resolution;
	vec2 t = fract(uniform_shadow_map_resolution * plcs.xy + vec2(0.5, 0.5));
	float shadow_map_z;
	float test = 0.0;
	shadow_map_z = texture(sampler_shadow_map, vec3(plcs.xy + vec2(shadow_map_step, shadow_map_step), slice)).r;
	test = (t.x)*(t.y)*clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	shadow_map_z = texture(sampler_shadow_map, vec3(plcs.xy + vec2(-shadow_map_step, +shadow_map_step), slice)).r;
	test += (1 - t.x)*(t.y)*clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	shadow_map_z = texture(sampler_shadow_map, vec3(plcs.xy + vec2(-shadow_map_step, -shadow_map_step), slice)).r;
	test += (1 - t.x)*(1 - t.y)*clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	shadow_map_z = texture(sampler_shadow_map, vec3(plcs.xy + vec2(shadow_map_step, -shadow_map_step), slice)).r;
	test += (t.x)*(1 - t.y)*clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	return test;
}

// PCF shadow mapping (using a 3x3 fixed kernel) with a constant bias
// Parameters:
// plcs: the position in light post-projective coordinates
// slice: the cascade index
// Returns the shadow factor for the current point
float shadow_pcf_3x3(vec3 plcs, int slice)
{
	// + shaded -> 0.0 
	// - lit -> 1.0
	float shadow_map_step = 0.5 / uniform_shadow_map_resolution;
	float sum = 0.0;
	// the center
	float shadow_map_z = texture(sampler_shadow_map, vec3(plcs.xy, slice)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [-1, +1]
	shadow_map_z = texture(sampler_shadow_map, vec3(plcs.xy + vec2(-shadow_map_step, +shadow_map_step), slice)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [0, +1]
	shadow_map_z = texture(sampler_shadow_map, vec3(plcs.xy + vec2(0.0, +shadow_map_step), slice)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [+1, -1]
	shadow_map_z = texture(sampler_shadow_map, vec3(plcs.xy + vec2(+shadow_map_step, +shadow_map_step), slice)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [-1, 0]
	shadow_map_z = texture(sampler_shadow_map, vec3(plcs.xy + vec2(-shadow_map_step, 0.0), slice)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [+1, 0]
	shadow_map_z = texture(sampler_shadow_map, vec3(plcs.xy + vec2(+shadow_map_step, 0.0), slice)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [-1, -1]
	shadow_map_z = texture(sampler_shadow_map, vec3(plcs.xy + vec2(-shadow_map_step, -shadow_map_step), slice)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [0, -1]
	shadow_map_z = texture(sampler_shadow_map, vec3(plcs.xy + vec2(0.0, -shadow_map_step), slice)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [+1, +1]
	shadow_map_z = texture(sampler_shadow_map, vec3(plcs.xy + vec2(+shadow_map_step, -shadow_map_step), slice)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);

	sum = sum / 9.0;
	return sum;
}

// PCF shadow mapping using a 4x4 gaussian kernal and adaptive bias
// Parameters:
// plcs: the position in [0-1) range in light post-projective coordinates
// slice: the cascade index
// Returns the shadow factor for the current point
float shadow_pcf_gaussian(vec3 plcs, int slice)
{
	float shadow_map_z = texture(sampler_shadow_map, vec3(plcs.xy, slice)).r;
	
	//float radius = 0.5 + (uniform_light_size)* (abs(plcs.z - shadow_map_z) / shadow_map_z);
	float radius = uniform_light_size;
	float sum_radius = 0.0;

	vec4 plcs_ecs = uniform_light_projection_inverse[slice] * vec4(2.0 * plcs - 1.0, 1.0);
	plcs_ecs /= plcs_ecs.w;

	for (int i = 0; i < 16; i++)
	{
		vec2 _kernel = radius * vec2(uniform_samples[i].xy);
		vec2 texel_offset = (0.1 + shadow_map_z)*10.0*_kernel / float(uniform_shadow_map_resolution);
		float shadow_map_z = texture(sampler_shadow_map, vec3(plcs.xy + texel_offset, slice)).r;
		vec4 plcs_sample_ecs = uniform_light_projection_inverse[slice] * vec4(2.0 * plcs.xy - 1.0, 2.0 * shadow_map_z - 1.0, 1.0);
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
		float shadow_map_z = texture(sampler_shadow_map, vec3(plcs.xy + texel_offset, slice)).r;
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

	// + shaded -> 0.0 
	// - lit -> 1.0
	return 1.0;
}

// Point-Cascade check
// Parameters:
// i: the cascade index
// plcs: the light space position of a WCS point
// pwcs: the point in WCS to check if it lies within the cascade
// Returns whether the current point is within a particular cascade
bool existsInCascade(int i, out vec4 plcs, vec4 pwcs)
{
	plcs = uniform_light_projection[i] * uniform_light_view * pwcs;
	plcs /= plcs.w;
	
	// check that we are inside light clipping frustum
	return (clamp(plcs.xy, vec2(-1,-1), vec2(1,1)) - plcs.xy) == vec2(0,0);
}

// Cascade shadow mapping function
// Parameters:
// pecs: the eye space position
// slice: the cascade index
// Returns the shadow factor for the current point
float sampleCascade(vec3 plcs, int slice)
{
	plcs.xyz = (plcs.xyz + 1) * 0.5;
	//return shadow_nearest(plcs.xyz, slice);
	//return shadow_pcf_2x2_bilinear_interpolation(plcs.xyz, slice);
	//return shadow_pcf_3x3(plcs.xyz, slice);
	return shadow_pcf_gaussian(plcs.xyz, slice);
}

// Generic cascade shadow mapping function
// Parameters:
// pecs: the eye space position
// Returns the shadow factor for the current point
float shadow(vec3 pecs)
{
	vec4 pwcs = uniform_view_inverse * vec4(pecs, 1);
	float shadowFactor = 0.0;
	
	bool inside = false;
	for (int i = 0; i < uniform_light_projection_number; ++i)
	{
		vec4 plcs;
		inside = existsInCascade(i, plcs, pwcs);

		if (inside)
		{
			shadowFactor = sampleCascade(plcs.xyz, i);

			// is it near the edge?
			float offset = 0.1;
			bool in_band_zone = clamp(abs(plcs.x), 1-offset, 1) - abs(plcs.x) == 0;
			in_band_zone = in_band_zone || clamp(abs(plcs.y), 1-offset, 1) - abs(plcs.y) == 0;
			if (!in_band_zone) return shadowFactor;

			vec2 dist = vec2((vec2(1,1) - abs(plcs.xy))/offset);
			inside = existsInCascade((i+1), plcs, pwcs);

			if (inside && i < uniform_light_projection_number-1)
			{
				float max_dist = min(dist.x, dist.y);
				float shadowFactor2 = sampleCascade(plcs.xyz, i + 1);
				return mix(shadowFactor2, shadowFactor, max_dist);
			}
			else
				return shadowFactor;		
		}
	}

	return shadowFactor;
}

// Cascade visualization function
// Parameters:
// pecs: the eye space position
// Returns a color representing the cascade for the current point
vec3 shadowCascadeColor(vec3 pecs)
{
	vec3 cascade_colors[8];
	cascade_colors[0] = vec3(1.0, 0.2, 0.2);
	cascade_colors[1] = vec3(0.2, 1.0, 0.2);
	cascade_colors[2] = vec3(0.2 ,0.2, 1.0);
	cascade_colors[3] = vec3(1.0, 0.2, 1.0);
	cascade_colors[4] = vec3(1.0, 1.0, 0.2);
	cascade_colors[5] = vec3(1.0 ,1.0, 1.0);
	cascade_colors[6] = vec3(1.0, 0.7, 0.2);
	cascade_colors[7] = vec3(0.2, 1.0, 0.7);

	vec4 pwcs = uniform_view_inverse * vec4(pecs, 1);
	vec3 shadowColor = vec3(0.0, 0.0, 0.0);
	
	bool inside = false;
	for (int i = 0; i < uniform_light_projection_number; ++i)
	{
		vec4 plcs;
		inside = existsInCascade(i, plcs, pwcs);

		if (inside)
		{
			shadowColor = cascade_colors[i];

			// is it near the edge?
			float offset = 0.1;
			bool in_band_zone = clamp(abs(plcs.x), 1-offset, 1) - abs(plcs.x) == 0;
			in_band_zone = in_band_zone || clamp(abs(plcs.y), 1-offset, 1) - abs(plcs.y) == 0;
			if (!in_band_zone) return shadowColor;

			vec2 dist = vec2((vec2(1,1) - abs(plcs.xy))/offset);
			inside = existsInCascade(i+1, plcs, pwcs);

			if (inside)
			{
				float max_dist = min(dist.x, dist.y);
				return mix(cascade_colors[i+1], cascade_colors[i], max_dist);
			}
			else
				return shadowColor;		
		}
	}

	return shadowColor;
}