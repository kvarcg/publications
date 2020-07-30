// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains code for BSDF sampling, lighting and shadow-mapping

#line 6

//------------------------------------------------------------ SPOTLIGHT SHADOWING START
#ifdef SHADING_STAGE
// Checks whether a particular incident (light) direction is inside or outside a spotlight
// Parameters:
// view: matrix to convert light direction to ECS (same space as the other calculations)
// vertex_to_light_direction_ecs: the incident direction (light or next vertex) 
// Returns the amount of light being cut off by the spotlight
float check_spotlight(vec3 vertex_to_light_direction_ecs)
{
	float spoteffect = 1;
	if (uniform_light_is_conical == 1)
	{
		vec3 light_direction_ecs = uniform_light_direction;
		float angle_vertex_spot_dir = dot(normalize(-vertex_to_light_direction_ecs), light_direction_ecs);

		// if angle is less than the penumbra (cosine is reverse)
		// if angle is between the penumbra region
		// if angle is outside the umbra region
		if (angle_vertex_spot_dir >= uniform_light_cosine_penumbra) 
			spoteffect = 1;
		else if (uniform_light_cosine_penumbra > angle_vertex_spot_dir && uniform_light_cosine_umbra < angle_vertex_spot_dir)
		{
			float attenuate = (angle_vertex_spot_dir - uniform_light_cosine_umbra) / (uniform_light_cosine_penumbra - uniform_light_cosine_umbra);
			spoteffect = pow(attenuate, uniform_light_spotlight_exponent);
		}
		else spoteffect = 0;
	}
	return spoteffect;
}

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
float shadow_nearest(vec3 light_space_xyz)
{
	// sample shadow map
	float shadow_map_z = texture(sampler_rsm_depth, light_space_xyz.xy).r;

	//if (light_space_z - uniform_light_constant_bias > shadow_map_z) return 0.0;
	//else return 1.0;

	// + shaded -> 0.0 
	// - lit -> 1.0
	return clamp(-sign((light_space_xyz.z - uniform_light_constant_bias) - shadow_map_z), 0.0, 1.0);
}

// PCF shadow mapping using a 4x4 gaussian kernal and adaptive bias
// Parameters:
// plcs: the position in [0-1) range in light post-projective coordinates
// Returns the shadow factor for the current point
float shadow_pcf_gaussian(vec3 light_space_xyz)
{
	float shadow_map_z = texture(sampler_rsm_depth, light_space_xyz.xy).r;

//	float radius = 0.5 + 30.5 * abs((light_space_xyz_ecs.z - light_space_xyz_sample_ecs.z) / light_space_xyz_ecs.z);
	//radius = 1 + light_size * ((light_space_xyz.z - shadow_map_z)/light_space_xyz.z);

	float radius = uniform_light_size;
	float sum_radius = 0.0;
	
	vec4 light_space_xyz_ecs = uniform_light_projection_inverse * vec4(2.0 * light_space_xyz - 1.0, 1.0);
	light_space_xyz_ecs /= light_space_xyz_ecs.w;

	for (int i = 0; i < 16; i++)
	{
		vec2 _kernel = radius * vec2(uniform_light_pcf_samples[i].xy);
		vec2 texel_offset = (0.1+shadow_map_z)*10.0*_kernel/float(uniform_light_shadow_map_resolution);
		float shadow_map_z = texture(sampler_rsm_depth, light_space_xyz.xy + texel_offset).r;
		vec4 light_space_xyz_sample_ecs = uniform_light_projection_inverse * vec4(2.0 * light_space_xyz.xy - 1.0, 2.0 * shadow_map_z - 1.0, 1.0);
		light_space_xyz_sample_ecs /= light_space_xyz_sample_ecs.w;

		sum_radius =max(sum_radius, 10 * abs((light_space_xyz_ecs.z - light_space_xyz_sample_ecs.z) / light_space_xyz_ecs.z));
	}
	
	sum_radius *= radius;
    radius = max(sum_radius, 1.0);

	//return radius / 50.0;

	vec2 offset;
	int i = 0;

	vec2 offset_jittering = 0.4 * rand2n(vec2(220 * (light_space_xyz.xy-vec2(0.5,0.5))));
	float costheta = cos(offset_jittering.x * 6.28);
	float sintheta = sin(offset_jittering.x * 6.28);
	mat2 rotX = mat2(vec2(costheta, sintheta), vec2(-sintheta, costheta));
		
	float weight_total = 0.0;

	float res = 0;//clamp(-sign(light_space_xyz.z - uniform_light_constant_bias - shadow_map_z), 0.0, 1.0);	
	
	for (i = 0; i < 16; i++)
	{
		vec2 _kernel = vec2(uniform_light_pcf_samples[i].xy);
		_kernel = rotX * _kernel;
		//float dist = length(_kernel);
		float weight = 1;//exp(dist * dist);
		offset = 1 * radius * (_kernel + offset_jittering);
		vec2 texel_offset = offset/float(uniform_light_shadow_map_resolution);
		float shadow_map_z = texture(sampler_rsm_depth, light_space_xyz.xy + texel_offset).r;
		// constant depth bias
		//res += (clamp(-sign(light_space_xyz.z - uniform_light_constant_bias - shadow_map_z),0.0,1.0) * weight);
		// slope _bias
		float slope_bias = abs((texel_offset.x * d_anal_z_to_du_dv.x)) + abs((texel_offset.y * d_anal_z_to_du_dv.y)) + uniform_light_constant_bias;
		res += (clamp(-sign(light_space_xyz.z - slope_bias - shadow_map_z),0.0,1.0) * weight);
		weight_total += weight;
	}
	res /= weight_total;

	//if (res > 15/16.0) res = 1.0;

	return res;
	
	// + shaded -> 0.0 
	// - lit -> 1.0
	return 1.0;
}

// Generic shadow mapping function
// Parameters:
// pecs: the eye space position
// Returns the shadow factor for the current point
float shadow(vec3 pecs)
{
	vec4 pwcs = uniform_view_inverse[0] * vec4(pecs, 1);
	vec4 plcs = uniform_light_projection * uniform_light_view * pwcs;
	plcs /= plcs.w;
	plcs.xy = (plcs.xy + 1) * 0.5;
	
	// check that we are inside light clipping frustum
	//if (plcs.x < 0.0) return 0.0; if (plcs.y < 0.0) return 0.0; if (plcs.x > 1.0) return 0.0; if (plcs.y > 1.0) return 0.0;
	if ((clamp(plcs.xy, vec2(0,0), vec2(1,1)) - plcs.xy) != vec2(0,0)) return 0.0;

	// set scale of shadow map value to [-1,1] or
	// set scale of light space z vaule to [0, 1]
	plcs.z = (plcs.z + 1) * 0.5;

	initSlopeBias(plcs.xyz);

	float shadowFactor = 1;
	
	//shadowFactor = shadow_nearest(plcs.xyz);
	
	shadowFactor = shadow_pcf_gaussian(plcs.xyz);

	return shadowFactor;
}
//------------------------------------------------------------ SPOTLIGHT SHADOWING END


//------------------------------------------------------------ BLINN-PHONG BEGIN

// The Blinn-Phong BRDF for surface reflection
// Parameters:
// - I, the incident (light) direction
// - O, the outgoing (camera) direction
// - N, the normal vector
// - m,  the roughness (width) parameter
// Returns the Blinn-Phong BRDF
float phong_blinn_specular(vec3 L, vec3 V, vec3 N, float surface_smoothness)
{
	vec3 H = normalize(L + V);
	
	float hdotv = max(dot(H, N), 0.01);
	
	// normalized blinn-phong brdf
	return pow(hdotv, surface_smoothness) * (surface_smoothness + 8) / (8 * pi);
}

#endif // SHADING_STAGE
//------------------------------------------------------------ BLINN-PHONG END

//------------------------------------------------------------ CT BEGIN

#define DIFFUSE_LAMBERT
#define SPECULAR_MICROFACET
#ifdef SPECULAR_MICROFACET
#define __MICROFACET_MODEL__
#if defined MICROFACET_PHONG
	#define DISTRIBUTION_PHONG
	#define GEOMETRY_PHONG
#elif defined MICROFACET_COOKTORRANCE
	#define GEOMETRY_COOKTORRANCE
	#define DISTRIBUTION_BECKMANN
#elif defined MICROFACET_BECKMANN
	#define GEOMETRY_BECKMANN
	#define DISTRIBUTION_BECKMANN
#elif defined MICROFACET_GGX
	#define DISTRIBUTION_GGX_ISOTROPIC
	#define GEOMETRY_GGX
#endif // __MICROFACET_MODEL__
#endif // SPECULAR_MICROFACET

// fresnel terms
#define FRESNEL_SCHLICK

// The Phong NDF distribution, describing how the microfacet normals are distributed over the microsurface
// Parameters:
// - NH, the cosine of the angle between normal and microfacet normal
// - m, the roughness (width) parameter
// returns the NDF
float Distribution_Phong(float NH, float m)
{
	float surface_smoothness = (1.0 - m) * 127.0;
	return pow(NH, surface_smoothness) * (surface_smoothness + 2.0) / (2.0 * pi);
}

// The Beckmann NDF, describing how the microfacet normals are distributed over the microsurface
// Parameters:
// - NH, the cosine of the angle between normal and microfacet normal
// - m, the roughness (width) parameter
// returns the NDF
float Distribution_Beckmann(float NH, float m)
{
	float NH2 = NH*NH;
	float m2 = max(0.001, m*m); 
	float D = exp((NH2-1.0)/(m2*NH2+0.001))/(pi*m2*NH2*NH2+0.001);
	return D;   
}

// The Trowbridge-Reitz (GGX) isotropic NDF distribution, describing how the microfacet normals are distributed over the microsurface
// Parameters:
// - NH, the cosine of the angle between normal and microfacet normal
// - m, the roughness (width) parameter
// returns the NDF
float Distribution_GGX_isotropic(float NH, float m)
{
	float NH2 = NH*NH;
	float m2 = max(0.001, m*m); 
	float denom = (NH2 * (m2 - 1) + 1);
	//float tan_a = tan(acos(NH));
	//float denom = NH2 * (m2 + tan_a * tan_a);
	denom = pi * denom * denom;
	float D = m2 / denom;
	return D;   
}

// The CookTorrance Shadowing-Masking function, describing the portion of the microsurface visible in both directions I and O
// Parameters:
// - NH, the cosine of the angle between normal and microfacet normal
// - NO, cosine of the angle between normal and out (view) dir
// - HO, cosine of the angle between microfacet normal and out (view) dir
// - NI, the cosine of the angle between normal and incident (light) dir
// returns the Geometric term
float Geometric_CookTorrance(float NH, float NO, float HO, float NI)
{ 
	float G = 2.0 * NH * min(NI, NO) / (0.001 + HO);
	G /= (0.001 + HO);
	return min(1.0, G);
}

// The Phong Shadowing-Masking function, describing the portion of the microsurface visible in both directions I and O
// Parameters:
// - NO, cosine of the angle between normal and out (view) dir
// - m, the roughness (width) parameter
// returns the Geometric term
float Geometric_Phong(float NO, float m)
{ 	
	float surface_smoothness = (1.0 - m) * 127.0;
	//float tan_a = tan(acos(NI));
	//float a = sqrt(0.5 * surface_smoothness + 1.0) / tan_a; 
	float NO2 = NO * NO;
	float a2 = NO2 * (0.5 * surface_smoothness + 1) / (1 - NO2);
	float a = sqrt(a2);
	return (a < 1.6) ? (3.535 * a + 2.181 * a2) / (1.0 + 2.276 * a + 2.577 * a2) : 1.0;
}

// The Beckmann Shadowing-Masking function, describing the portion of the microsurface visible in both directions I and O
// Parameters:
// - NO, cosine of the angle between normal and out (view) dir
// - m, the roughness (width) parameter
// returns the Geometric term
float Geometric_Beckmann(float NO, float m)
{ 
	//float tan_a = tan(acos(NI));
	//float a = 1.0 / (m * tan_a);
	float a = NO / (m * sqrt(1 - (NO * NO)));
	float a2 = a * a;
	return (a < 1.6) ? (3.535 * a + 2.181 * a2) / (1.0 + 2.276 * a + 2.577 * a2) : 1.0;
}

// The Trowbridge-Reitz (GGX) Shadowing-Masking function, describing the portion of the microsurface visible in both directions I and O
// Parameters:
// - NO, cosine of the angle between normal and out (view) dir
// - m, the roughness (width) parameter
// returns the Geometric term
float Geometric_GGX(float NO, float m)
{ 
	//float tan_a = tan(acos(NI));
	//float denom = 1.0 + sqrt(1 + (m * m * tan_a * tan_a));
	// return NO / denom;
	float m2 = max(0.001, m*m); 
	float denom = NO + sqrt(m2 + (1 - m2) * (NO * NO));
	return (2.0 * NO) / denom;
}

#ifdef SHADING_STAGE
// The Fresnel term using Shlick's approximation.
// Parameters:
// - RO, the reflected color at normal angle
// - NO, cosine of the angle between normal and out (view) dir
// returns the Fresnel term
vec3 Fresnel_Schlick(vec3 R0, float NO)
{
	float u = 1.0 - NO;
	float u5 = u * u;
	u5 = u5 * u5 * u;
	return min(vec3(1.0), R0 + (vec3(1.0) - R0) * u5);
}

// The Lambert BRDF for body reflection
// Parameters:
// - vertex: the vertex data
// Returns the Lambert BRDF
vec3 Lambert_BRDF(in Vertex vertex)
{
	return vertex.color.rgb/pi;
}

// The Microfacet BRDF function, describing the scattered light energy towards a particular direction
// Parameters:
// O: the out direction (camera or prev vertex)
// I: the incident direction (light or next vertex) 
// - vertex: the vertex data
// Returns the reflected RGB color
vec3 Microfacet_Lambert_BSDF(in vec3 O, in vec3 I, in Vertex vertex)
{
	// The halfway vector (the microfacet normal)
	vec3 H = O + I;
	H = normalize(H);
  
	// dot products used frequently
	// cosine of the angle between normal and incident (light) dir -> theta_i
	float NI = dot(vertex.normal,I);
	// cosine of the angle between normal and out (view) dir -> theta_o
	float NO = dot(vertex.normal,O);
	// cosine of the angle between microfacet normal and normal -> theta_h
	float NH = dot(vertex.normal, H);
	// cosine of the angle between microfacet normal and out (view) dir -> alpha_h
	float HO = dot(H, O);	

	// Reflectivity vs Transmission
	vec3 C0 = vertex.reflectivity*mix(vec3(1.0),vertex.color.rgb,vec3(vertex.metal));
	vec3 F = vec3(1.0);
#ifdef FRESNEL_SCHLICK
	if (vertex.transmission == false)
		F = Fresnel_Schlick(C0, max(0.0, HO));
	else
	{
		vec3 ref_dir = reflect(-I, vertex.normal);
		NO = dot(ref_dir, vertex.normal);
		F = Fresnel_Schlick(C0, max(0.0, HO));
	}
#endif // FRESNEL_SCHLICK
	vec3 T = vec3(1.0) - F;
	
	// Microfacet distribution 
	float D = 1.0;
#if defined (DISTRIBUTION_PHONG)
	D = (NH <= 0.0) ? 0.0 : Distribution_Phong(NH,vertex.roughness);   
#elif defined (DISTRIBUTION_BECKMANN)
	D = (NH <= 0.0) ? 0.0 : Distribution_Beckmann(NH,vertex.roughness);  
#elif defined (DISTRIBUTION_GGX_ISOTROPIC)
	D = (NH <= 0.0) ? 0.0 : Distribution_GGX_isotropic(NH,vertex.roughness);  
#endif
	// Masking/shadowing geometric terms
	float G = 1.0;
#if defined (GEOMETRY_PHONG)
	G = (HO * NO <= 0.0) ? 0.0 : Geometric_Phong(NO, vertex.roughness); 
#elif defined (GEOMETRY_COOKTORRANCE)
	G = (HO * NO <= 0.0) ? 0.0 : Geometric_CookTorrance(NH, NO, HO, NI);
#elif defined (GEOMETRY_BECKMANN)
	G = (HO * NO <= 0.0) ? 0.0 : Geometric_Beckmann(NO, vertex.roughness);  
#elif defined (GEOMETRY_GGX)
	G = (HO * NO <= 0.0) ? 0.0 : Geometric_GGX(NO, vertex.roughness);  
#endif
	// specular component    
	// specular color is characterized by its Fresnel reflectance
	vec3 K_s = F;

	vec3 specular_brdf;
	if (vertex.roughness < 0.01)
	{	
		G = 1;
		D = (NH <= 0.0) ? 0.0 : Distribution_Phong(NH,vertex.roughness);   
		specular_brdf = (NO * NI > 0.0) ? D * G * K_s * 0.25 : vec3(0.0);
	}
	else
	{
		specular_brdf = (NO * NI > 0.0) ? K_s * G * D * 0.25 / (0.001 + abs(NO) * abs(NI)) : vec3(0.0);
	}
	
	vec3 final_color = vec3(0,0,0);
  
	vec3 transmitted_coef = T * vec3(1.0 - vertex.metal);
#ifdef DIFFUSE_LAMBERT
	// diffuse component (Lambert)
	// diffuse is calculated by using the transmitted energy
	// and adjusting it with its metalness (metals - conductors are characterized mostly by
	// their surface reflectance)
	// of course, this process is much more complicated :)
	vec3 diffuse_brdf = Lambert_BRDF(vertex) * transmitted_coef * vertex.opacity;
	final_color += diffuse_brdf;
#endif // DIFFUSE_LAMBERT
#ifdef SPECULAR_MICROFACET
	final_color += vertex.transmission == false ? specular_brdf : vec3(0.0);
#endif // SPECULAR_MICROFACET
#ifdef SPECULAR_MICROFACET
	vec3 specular_btdf = vertex.transmission == true && (NI*NO < 0.0) ? (vertex.color.xyz * 1 * transmitted_coef /* vertex.optical_thickness */ * (1 - vertex.opacity) ) : vec3(0.0);
	final_color += specular_btdf;
#endif // SPECULAR_MICROFACET

	return final_color;
}

// The NdotL factor, encompassing the phenomenon where the number of photons intercepted by a particular patch on
// a surface decreases proportionally to the cosine between the indicent (light) direction and the surface normal vector
// Parameters:
// - vertex_to_next_dir: the vertex to incident (light) direction
// - vertex: the vertex
// Returns the NdotL factor
float NdotL(in vec3 vertex_to_next_dir, in Vertex vertex)
{
    return max(0.0, dot(vertex.normal, vertex_to_next_dir));
}

// The Geometric term, expressing the energy exchange between two points
// a surface decreases proportionally to the cosine between the indicent (light) direction and the surface normal vector
// Parameters:
// - current_to_new_vertex_dir: the current to next vertex direction
// - current_vertex: the current vertex
// - next_vertex: the next vertex
// Returns the geometric term
float getGeometricTerm(in vec3 current_to_new_vertex_dir, in Vertex current_vertex, in Vertex next_vertex)
{
	vec3 vertex_dir = (current_vertex.transmission == false) ? current_to_new_vertex_dir : -current_to_new_vertex_dir;
	// visibility is always 1 since this point has been traced
    float geometric_term = NdotL(vertex_dir, current_vertex);
	if (next_vertex.opacity == 1)
		geometric_term = (dot(next_vertex.normal, -current_to_new_vertex_dir) < 0.0) ? 0.0 : geometric_term;
	return geometric_term;
}

// The Geometric term, expressing the energy exchange between two points
// For a point light source, this resolves to the NdotL factor
// Parameters:
// - vertex_to_light_dir: the current vertex to light direction
// - vertex: the vertex
// Returns the geometric term
float getGeometricTermPointLightSource(in vec3 vertex_to_light_dir, in Vertex vertex)
{
	// visibility is always 1 since this point has been traced
    float geometric_term = NdotL(vertex_to_light_dir, vertex);
	return geometric_term;
}
//------------------------------------------------------------ CT END
#endif // SHADING_STAGE

//------------------------------------------------------------ SAMPLING START

// Generates a sample on a sphere using a uniform distribution
// Parameters:
// - iteration: a sampling seed value
// Returns the generated sample
vec3 getUniformSphereSample(float iteration) {
	vec2 seed = getSamplingSeed(iteration);
	vec2 r = rand2n(seed);
	float phi = r.x*2.*pi;

	float cosTheta = 1.0 - 2.0 * r.y;
	float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
	return vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
} 

// Generates a sample on a hemisphere using a uniform distribution
// Parameters:
// - iteration: a sampling seed value
// Returns the generated sample
vec3 getUniformHemisphereSample(float iteration) {
	vec2 seed = getSamplingSeed(iteration);
	vec2 u = rand2n(seed);
	float r = sqrt(max(0.0, 1.0 - u.x * u.x));
	float phi = 2.0 * pi * u.y;
	float x = r * cos(phi);
	float y = r * sin(phi);
	return vec3(x,y,u.x);
} 

// Generates a sample on a hemisphere using a cosine-weighted distribution
// Parameters:
// - iteration: a sampling seed value
// Returns the generated sample
vec3 getCosineHemisphereSample(float iteration) {
	vec2 seed = getSamplingSeed(iteration);
	vec2 r = rand2n(seed);
	float phi = r.x*2.*pi;
	float cosTheta = sqrt(1 - r.y);
	float sinTheta = sqrt(1.0 - cosTheta * cosTheta);

	return vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
} 

// Generates a sample on a sphere using a uniform distribution and its PDF
// Parameters:
// - out_inv_pdf: the inverse PDF
// - bounce: a sampling seed value
// Returns the generated sample
vec3 getNewSamplePositionUniformSphereSampling(out float out_inv_pdf, float bounce)
{
	vec3 cur_sample = getUniformSphereSample(bounce);

	// calculate pdf
	out_inv_pdf = pi * 0.25;

	return cur_sample;
}

// Generates a sample on a hemisphere using a uniform distribution and its PDF
// Parameters:
// - out_inv_pdf: the inverse PDF
// - vertex: the vertex
// - random_rotation_angle: a rotation value for jittering the hemisphere
// - bounce: a sampling seed value
// Returns the generated sample
vec3 getNewSamplePositionUniformHemisphereSampling(out float out_inv_pdf, in Vertex vertex, float random_rotation_angle, float bounce)
{
	// calculate tangent, bitangent
	vec3 tangent = cross(vertex.normal, vec3(0.0, 1.0, 0.0));
	if (dot(tangent, tangent) < 1.e-3f)
		tangent = cross(vertex.normal, vec3(1.0, 0.0, 0.0));
	tangent = normalize(tangent);
	vec3 bitangent = cross(vertex.normal, tangent);
	
	vec3 cur_sample = getUniformHemisphereSample(bounce);
	vec3 current_vertex_sample_dir = normalize(tangent*cur_sample.x + bitangent*cur_sample.y + vertex.normal * cur_sample.z);

	// calculate pdf
	out_inv_pdf = pi * 0.5;

	return current_vertex_sample_dir;
}

// Generates a sample on a hemisphere using a cosine-weighted distribution and its PDF
// Parameters:
// - out_inv_pdf: the inverse PDF
// - vertex: the vertex
// - random_rotation_angle: a rotation value for jittering the hemisphere
// - bounce: a sampling seed value
// Returns the generated sample
vec3 getNewSamplePositionCosineHemisphereSampling(out float out_inv_pdf, in Vertex vertex, float random_rotation_angle, float bounce)
{
	// calculate tangent, bitangent
	vec3 tangent = cross(vertex.normal, vec3(0.0, 1.0, 0.0));
	if (dot(tangent, tangent) < 1.e-3f)
		tangent = cross(vertex.normal, vec3(1.0, 0.0, 0.0));
	tangent = normalize(tangent);
	vec3 bitangent = cross(vertex.normal, tangent);
	
	vec3 cur_sample = getCosineHemisphereSample(bounce);
	vec3 current_vertex_sample_dir = normalize(tangent*cur_sample.x + bitangent*cur_sample.y + vertex.normal * cur_sample.z);

	// calculate pdf
	float d = max(0.0, dot(vertex.normal, current_vertex_sample_dir));
	out_inv_pdf = (d > 0.0) ? pi / d : 0.0;

	return current_vertex_sample_dir;
}

#if !defined (TEST_DIFFUSE_RAYS) && !defined (TEST_VISIBILITY_RAYS) && !defined (TEST_REFLECTION_RAYS)
// Generates a refraction direction
// Parameters:
// - out_inv_pdf: the inverse PDF
// - prev_vertex_position: the previous vertex position
// - current_vertex: the current vertex
// - transmission: a flag indicating whether the new direction is below the hemisphere
// Returns the generated sample
vec3 getNewSamplePositionRefractionSampling(out float out_inv_pdf, in vec3 prev_vertex_position, in Vertex current_vertex, out bool transmission)
{
	vec3 prev_vertex_to_current_vertex_dir = normalize(current_vertex.position - prev_vertex_position);
	float d = dot(-prev_vertex_to_current_vertex_dir, current_vertex.normal);
	float indices_ratio = (d > 0.0) ? 1.0 / current_vertex.ior : current_vertex.ior;
	
	vec3 current_vertex_sample_dir = refract(prev_vertex_to_current_vertex_dir, current_vertex.normal, indices_ratio);
	transmission = current_vertex_sample_dir != vec3(0);	
	
	// calculate pdf
	out_inv_pdf = 1;

	return current_vertex_sample_dir;
}

// Source for the microfacet sampling distributions: 
// Microfacet Models for Refraction through Rough Surfaces (Walter B. et. al.), EGSR 2007
// x1, x2 : uniformly distributed numbers [0, 1)
// Phong Sampling:
// theta_m = arccos(pow(x1, 1.0 / (a_p + 2.0))
// phi_m = 2 * p * x2
// Conversion between a_p and a_b: 
// a_p = 2 * pow(a_b, -2) - 2
//
// Beckmann Sampling:
// theta_m = arctan(sqrt(-a_b * log(1 - x1)))
// phi_m = 2 * p * x2
//
// GGX Sampling:
// theta_m = arctan(a_g * sqrt(x1) / sqrt(1 - x1))
// phi_m = 2 * p * x2
//
// Parameters:
// - out_inv_pdf: the inverse PDF
// - prev_vertex_position: the previous vertex position
// - current_vertex: the current vertex
// - bounce: the path iteration
// - transmission: a flag indicating whether the new direction is below the hemisphere
// Returns the generated sample
vec3 getNewSamplePositionNDFSampling(out float out_inv_pdf, in vec3 prev_vertex_position, in Vertex current_vertex, float bounce, out bool transmission)//, out int res)
{
	vec2 seed = getSamplingSeed(bounce);
	vec3 r = rand3n(seed);
	transmission = false;
	vec3 I = normalize(current_vertex.position - prev_vertex_position);
	
	vec3 sample_dir = vec3(0);
#ifndef TEST_GLOSSY_RAYS						
	bool diffuse_sampling = r.x > current_vertex.reflectivity;

	// for highly specular surfaces, simply return the reflection vector
	if (!diffuse_sampling && !transmission && current_vertex.roughness < 0.01)
	{
		out_inv_pdf = 1.0;
		return reflect(I, current_vertex.normal);
	}
	
	// for highly refractive surfaces, simply return the refraction vector
	if (!diffuse_sampling && transmission && current_vertex.roughness < 0.01)
	{
		out_inv_pdf = 1.0f;
		float d = dot(-I, current_vertex.normal);
		float indices_ratio = (d > 0.0) ? 1.0 / current_vertex.ior : current_vertex.ior;
		return refract(I, current_vertex.normal, indices_ratio);		
	}

	if (transmission)
	{
		sample_dir = getNewSamplePositionRefractionSampling(out_inv_pdf, prev_vertex_position, current_vertex, transmission);
		// fallback case
		transmission = sample_dir != vec3(0);
	}
	
	if (diffuse_sampling)
	{
		sample_dir = getNewSamplePositionCosineHemisphereSampling(out_inv_pdf, current_vertex, r.x * 2.0 * pi, bounce);
		sample_dir *= transmission ? -1: 1;
		return sample_dir;
	}
#endif // TEST_GLOSSY_RAYS

	// generate microfacet	
	// beckmann sampling (modify this to change sampling patter)
#if defined (DISTRIBUTION_PHONG)
	float m = (1.0 - current_vertex.roughness) * 127.0;
	float costheta = pow(r.x, 1.0 / (m + 2.0));
	float sintheta = sqrt(1.0 - costheta * costheta);
#elif defined (DISTRIBUTION_BECKMANN)
	float tantheta2 = -log(r.x) * current_vertex.roughness*current_vertex.roughness;
	float costheta = sqrt(1.0/(1.0+tantheta2));
	float sintheta = sqrt(1.0 - costheta * costheta);
#elif defined (DISTRIBUTION_GGX_ISOTROPIC)
	float tantheta = current_vertex.roughness * sqrt(r.x) / sqrt(1 - r.x);
	float tantheta2 = tantheta * tantheta;
	float costheta = sqrt(1.0/(1.0+tantheta2));
	float sintheta = sqrt(1.0 - costheta * costheta);
#endif
	
	// align with normal hemisphere
	float phi = 2 * pi * r.y;
	float _x = cos(phi) * sintheta;
	float _y = sin(phi) * sintheta;
	float _z = costheta;

	// calculate tangent, bitangent
	vec3 right = cross(current_vertex.normal, vec3(0.0, 1.0, 0.0));
	if (dot(right, right) < 1.e-3f)
		right = cross(current_vertex.normal, vec3(1.0, 0.0, 0.0));
	right = normalize(right);
	vec3 front = cross(current_vertex.normal, right);

	vec3 H = normalize(_x * right + _y * front + _z * current_vertex.normal);

	// angle between microfacet normal and previous vertex -> alpha_h
	float HI = (dot(H,-I));
	// angle between microfacet normal and normal -> theta_h
	float HN = dot(H, current_vertex.normal);
	float HN_clamped = max(0.0, HN);
	
	if (!transmission)
		sample_dir = reflect(I, H);
	
	vec3 normal = transmission ? -current_vertex.normal : current_vertex.normal;

	// if the angle between the microfacet normal and the macrosurface normal
	// or the angle between the new sample direction and the macrosurface normal
	// is on the wrong side of the hemisphere, just switch back to cosine sampling
	// to avoid skipping the sample
	// the pdf weighting 4 * dot(NI) is based on: 
	// Notes on the Ward BRDF.Technical Report PCG - 05 - 06
	// http://www.graphics.cornell.edu/~bjw/wardnotes.pdf
	if (HN_clamped > 0.0 && max(0.0, dot(sample_dir, normal)) > 0.0)
	{
	#if defined (DISTRIBUTION_PHONG)
		float pdf = Distribution_Phong(HN, current_vertex.roughness) * abs(HN) * 0.25 / abs(HI);
	#elif defined (DISTRIBUTION_BECKMANN)
		float pdf = Distribution_Beckmann(HN, current_vertex.roughness) * abs(HN) * 0.25 / abs(HI);
	#elif defined (DISTRIBUTION_GGX_ISOTROPIC)
		float pdf = Distribution_GGX_isotropic(HN, current_vertex.roughness) * abs(HN) * 0.25 / abs(HI);
	#endif
		out_inv_pdf = 1.0 / max(0.001, pdf);
	}
	else
	{
		// drop to cosine sampling if the angle between the microfacet sample direction and the macrosurface normal is above 90 degrees
		sample_dir = getNewSamplePositionCosineHemisphereSampling(out_inv_pdf, current_vertex, r.x * 2.0 * pi, bounce);
	}

	return sample_dir;
}
#endif // TEST_DIFFUSE_RAYS
//------------------------------------------------------------ SAMPLING END