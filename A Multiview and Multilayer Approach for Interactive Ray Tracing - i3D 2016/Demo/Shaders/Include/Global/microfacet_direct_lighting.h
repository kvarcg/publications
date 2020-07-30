#line 2
// Various Lighting Utilities

#define DIFFUSE_LAMBERT
#define SPECULAR_MICROFACET
#define MICROFACET_GGX
#ifdef SPECULAR_MICROFACET
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
#define FRESNEL_SCHLICK

#ifndef PI
#define PI 3.1415936
#endif // PI

// The Phong NDF distribution, describing how the microfacet normals are distributed over the microsurface
// Parameters:
// - NH, the cosine of the angle between normal and microfacet normal
// - m, the roughness (width) parameter
// returns the NDF
float Distribution_Phong(float NH, float m)
{
	float surface_smoothness = (1.0 - m) * 127.0;
	return pow(NH, surface_smoothness) * (surface_smoothness + 2.0) / (2.0 * PI);
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
	float D = exp((NH2 - 1.0) / (m2*NH2 + 0.001)) / (PI*m2*NH2*NH2 + 0.001);
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
	denom = PI * denom * denom;
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
	float tan_a = tan(acos(NO));
	float denom = 1.0 + sqrt(1 + (m * m * tan_a * tan_a));
	 return NO / denom;
	//float m2 = max(0.001, m*m);
	//float denom = NO + sqrt(m2 + (1 - m2) * (NO * NO));
	//return (2.0 * NO) / denom;
}

// The Fresnel term using Shlick's approximation.
// Parameters:
// - RO, the reflected color at normal angle
// - NO, cosine of the angle between normal and out (view) dir
// returns the Fresnel term
vec3 Fresnel_Schlick(vec3 R0, float HO)
{
	float u = 1.0 - HO;
	float u5 = u * u;
	u5 = u5 * u5 * u;
	return min(vec3(1.0), R0 + (vec3(1.0) - R0) * u5);
}

// The Lambert BRDF for body reflection
// Parameters:
// - diffuce_color: the material's color or the albedo of the surface, i.e., the amount of energy being reflected instead of absorbed.
// Returns the Lambert BRDF
vec3 Lambert_BRDF(in vec3 diffuse_color)
{
	return diffuse_color.rgb / PI;
}

// The Microfacet BRDF function, describing the scattered light energy towards a particular direction
// Parameters:
// O: the out direction (camera or prev vertex)
// I: the incident direction (light or next vertex) 
// normal: the macrosurface normal
// diffuce_color: the material's color or the albedo of the surface, i.e., the amount of energy being reflected instead of absorbed.
// spec_parameters: a vector containing the reflectivity, glossiness and metalicity parameters of the surface
// Returns the reflected RGB color
vec3 MicrofacetBRDF(in vec3 O, in vec3 I, in vec3 normal, in vec3 diffuse_color, in vec3 spec_parameters)
{
	float reflectivity = spec_parameters.x;
	float roughness = 1.0 - spec_parameters.y;
	float metal = spec_parameters.z;

	// The halfway vector (the microfacet normal)
	vec3 H = O + I;
	H = normalize(H);

	// dot products used frequently
	// cosine of the angle between normal and incident (light) dir -> theta_i
	float NI = dot(normal, I);
	// cosine of the angle between normal and out (view) dir -> theta_o
	float NO = dot(normal, O);
	// cosine of the angle between microfacet normal and normal -> theta_h
	float NH = dot(normal, H);
	// cosine of the angle between microfacet normal and out (view) dir -> alpha_h
	float HO = dot(H, O);

	// Reflectivity vs Transmission
	vec3 C0 = reflectivity * mix(vec3(1.0), diffuse_color.rgb, vec3(metal));
	vec3 F = vec3(1.0);
#ifdef FRESNEL_SCHLICK
	F = Fresnel_Schlick(C0, max(0.0, dot(H, O)));
#endif // FRESNEL_SCHLICK
	vec3 T = 1.0 - F;

	// Microfacet distribution and masking/shadowing geometric terms
	float D = 1.0;
#if defined (DISTRIBUTION_PHONG)
	D = (NH <= 0.0) ? 0.0 : Distribution_Phong(NH, roughness);
#elif defined (DISTRIBUTION_BECKMANN)
	D = (NH <= 0.0) ? 0.0 : Distribution_Beckmann(NH, roughness);
#elif defined (DISTRIBUTION_GGX_ISOTROPIC)
	D = (NH <= 0.0) ? 0.0 : Distribution_GGX_isotropic(NH, roughness);
#endif

	float G = 1.0;
#if defined (GEOMETRY_PHONG)
	G = (HO * NO <= 0.0) ? 0.0 : Geometric_Phong(NO, roughness);
#elif defined (GEOMETRY_COOKTORRANCE)
	G = (HO * NO <= 0.0) ? 0.0 : Geometric_CookTorrance(NH, NO, HO, NI);
#elif defined (GEOMETRY_BECKMANN)
	G = (HO * NO <= 0.0) ? 0.0 : Geometric_Beckmann(NO, roughness);
#elif defined (GEOMETRY_GGX)
	G = (HO * NO <= 0.0) ? 0.0 : Geometric_GGX(NO, roughness);
#endif
	// specular component    
	// specular color is characterized by its Fresnel reflectance
	vec3 K_s = F;

	vec3 specular_brdf;
	if (roughness < 0.01)
	{
		G = 1;
		D = (NH <= 0.0) ? 0.0 : Distribution_Phong(NH, roughness);
		specular_brdf = (NO * NI > 0.0) ? D * G * K_s * 0.25 : vec3(0.0);
	}
	else
	{
		specular_brdf = (NO * NI > 0.0) ? K_s * G * D * 0.25 / (0.001 + abs(NO) * abs(NI)) : vec3(0.0);
	}

	vec3 final_color = vec3(0, 0, 0);

	vec3 transmitted_coef = T * vec3(1.0 - metal);
#ifdef DIFFUSE_LAMBERT
	// diffuse component (Lambert)
	// diffuse is calculated by using the transmitted energy
	// and adjusting it with its metalness (metals - conductors are characterized mostly by
	// their surface reflectance)
	// of course, this process is much more complicated :)
	vec3 diffuse_brdf = Lambert_BRDF(diffuse_color) * transmitted_coef;
	final_color += diffuse_brdf;

#endif // DIFFUSE_LAMBERT
#ifdef SPECULAR_MICROFACET
	final_color += specular_brdf;
#endif // SPECULAR_MICROFACET

	return final_color * max(0.0, NI);
}

// The Microfacet BRDF function, describing the scattered light energy towards a particular direction
// This is the same function as above, except that it uses the opacity parameter for diffuse calculations,
// which is assumed to be 1.0 in the calculations above, and returns the transmittance (e.g., for transparency effects)
// Parameters:
// O: the out direction (camera or prev vertex)
// I: the incident direction (light or next vertex) 
// normal: the macrosurface normal
// diffuce_color: the material's color or the albedo of the surface, i.e., the amount of energy being reflected instead of absorbed.
// spec_parameters: a vector containing the reflectivity, glossiness and metalicity parameters of the surface
// opacity: the opacity of the current fragment (1.0 for opaque rendering)
// T: the resulting transmittance coefficients
// Returns the reflected RGB color
vec3 MicrofacetBRDFTr(in vec3 O, in vec3 I, in vec3 normal, in vec3 diffuse_color, in vec3 spec_parameters, in float opacity, out vec3 T)
{
	float reflectivity = spec_parameters.x;
	float roughness = 1.0 - spec_parameters.y;
	float metal = spec_parameters.z;

	// The halfway vector (the microfacet normal)
	vec3 H = normalize(O + I);

	// dot products used frequently
	// cosine of the angle between normal and incident (light) dir -> theta_i
	float NI = dot(normal, I);
	// cosine of the angle between normal and out (view) dir -> theta_o
	float NO = dot(normal, O);
	// cosine of the angle between microfacet normal and normal -> theta_h
	float NH = dot(normal, H);
	// cosine of the angle between microfacet normal and out (view) dir -> alpha_h
	float HO = dot(H, O);

	// Reflectivity vs Transmission
	vec3 C0 = reflectivity * mix(vec3(1.0), diffuse_color.rgb, vec3(metal));
	vec3 F = vec3(1.0);
#ifdef FRESNEL_SCHLICK
	F = Fresnel_Schlick(C0, max(0.0, dot(H, O)));
#endif // FRESNEL_SCHLICK
	T = 1.0 - F;

	// Microfacet distribution and masking/shadowing geometric terms
	float D = 1.0;
#if defined (DISTRIBUTION_PHONG)
	D = (NH <= 0.0) ? 0.0 : Distribution_Phong(NH, roughness);
#elif defined (DISTRIBUTION_BECKMANN)
	D = (NH <= 0.0) ? 0.0 : Distribution_Beckmann(NH, roughness);
#elif defined (DISTRIBUTION_GGX_ISOTROPIC)
	D = (NH <= 0.0) ? 0.0 : Distribution_GGX_isotropic(NH, roughness);
#endif

	float G = 1.0;
#if defined (GEOMETRY_PHONG)
	G = (HO * NO <= 0.0) ? 0.0 : Geometric_Phong(NO, roughness);
#elif defined (GEOMETRY_COOKTORRANCE)
	G = (HO * NO <= 0.0) ? 0.0 : Geometric_CookTorrance(NH, NO, HO, NI);
#elif defined (GEOMETRY_BECKMANN)
	G = (HO * NO <= 0.0) ? 0.0 : Geometric_Beckmann(NO, roughness);
#elif defined (GEOMETRY_GGX)
	G = (HO * NO <= 0.0) ? 0.0 : Geometric_GGX(NO, roughness);
#endif
	// specular component    
	// specular color is characterized by its Fresnel reflectance
	vec3 K_s = F;

	vec3 specular_brdf;
	if (roughness < 0.01)
	{
		G = 1;
		D = (NH <= 0.0) ? 0.0 : Distribution_Phong(NH, roughness);
		specular_brdf = (NO * NI > 0.0) ? D * G * K_s * 0.25 : vec3(0.0);
	}
	else
	{
		specular_brdf = (NO * NI > 0.0) ? K_s * G * D * 0.25 / (0.001 + abs(NO) * abs(NI)) : vec3(0.0);
	}

	vec3 final_color = vec3(0, 0, 0);

	vec3 transmitted_coef = T * vec3(1.0 - metal);
#ifdef DIFFUSE_LAMBERT
	// diffuse component (Lambert)
	// diffuse is calculated by using the transmitted energy
	// and adjusting it with its metalness (metals - conductors are characterized mostly by
	// their surface reflectance)
	// of course, this process is much more complicated :)
	vec3 diffuse_brdf = Lambert_BRDF(diffuse_color) * transmitted_coef * opacity;
	final_color += diffuse_brdf;
#endif // DIFFUSE_LAMBERT
#ifdef SPECULAR_MICROFACET
	final_color += specular_brdf;
#endif // SPECULAR_MICROFACET

	return final_color * max(0.0, NI);
}

// The Transmittance function, describing the amount of transmitted light energy
// Parameters:
// O: the out direction (camera or prev vertex)
// I: the incident direction (light or next vertex) 
// normal: the macrosurface normal
// diffuce_color: the material's color or the albedo of the surface, i.e., the amount of energy being reflected instead of absorbed.
// spec_parameters: a vector containing the reflectivity, glossiness and metalicity parameters of the surface
// Returns the reflected RGB color
vec3 Transmittance(in vec3 O, in vec3 I, in vec3 normal, in vec3 diffuse_color, in vec3 spec_parameters)
{
	float reflectivity = spec_parameters.x;
	float metal = spec_parameters.z;

	// The halfway vector (the microfacet normal)
	vec3 H = O + I;
	H = normalize(H);

	// Reflectivity vs Transmission
	vec3 C0 = reflectivity * mix(vec3(1.0), diffuse_color.rgb, vec3(metal));
	vec3 F = vec3(1.0);
#ifdef FRESNEL_SCHLICK
	F = Fresnel_Schlick(C0, max(0.0, dot(H, O)));
#endif // FRESNEL_SCHLICK
	return vec3(1.0 - F);
}

// The NdotL factor, encompassing the phenomenon where the number of photons intercepted by a particular patch on
// a surface decreases proportionally to the cosine between the indicent (light) direction and the surface normal vector
// Parameters:
// - I: the incident (light) direction
// - N: the normal vector
// Returns the NdotL factor
float NdotL(vec3 I, vec3 N)
{
	return max(dot(N, I), 0.0);
}

// The NdotL factor, slightly modified to enhance shadowed areas
// Parameters:
// - I: the incident (light) direction
// - N: the normal vector
// Returns the NdotL factor
float NdotL_enhanced(vec3 I, vec3 N)
{
	return max(0.5 * (1.0 + dot(N, I)), 0.0);
}

// Calculates the reflection vector
// Parameters:
// - I the incident direction, looking away from the point of interest
// - N: the normal vector, looking away from the point of interest
// Returns the reflection vector
vec3 calc_reflection_vector(vec3 I, vec3 N)
{
	return normalize((2.0*N*dot(N, I)) - I);
}

// The Phong BRDF for surface reflection
// Parameters:
// - I, the incident (light) direction
// - O, the outgoing (camera) direction
// - N, the normal vector
// - m,  the roughness (width) parameter
// Returns the Phong BRDF
float phong_specular(vec3 I, vec3 O, vec3 N, float m)
{
	float surface_smoothness = (1.0 - m) * 127.0;
	vec3 R = calc_reflection_vector(I, N);

	float thdotv = max(dot(R, O), 0.01);

	// normalized phong brdf
	return pow(thdotv, surface_smoothness) * (surface_smoothness + 2) / (2 * PI);
}

// The Blinn-Phong BRDF for surface reflection
// Parameters:
// - I, the incident (light) direction
// - O, the outgoing (camera) direction
// - N, the normal vector
// - m,  the roughness (width) parameter
// Returns the Blinn-Phong BRDF
float phong_blinn_specular(vec3 I, vec3 O, vec3 N, float m)
{
	float surface_smoothness = (1.0 - m) * 127.0;
	vec3 H = normalize(I + O);

	float hdotv = max(dot(H, N), 0.01);

	// normalized blinn-phong brdf
	return pow(hdotv, surface_smoothness) * (surface_smoothness + 8) / (8 * PI);
}