import bpy
import os
import math

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if not bpy.data.scenes:
        bpy.data.scenes.new("Scene")

def create_octocat_3d_emblem(export_path):
    reset_scene()
    
    # 1. Base Medallion / Coin (Outer dark cylinder with bevel)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=64,
        radius=1.5,
        depth=0.25,
        location=(0, 0, 0),
        rotation=(math.radians(90), 0, 0)
    )
    coin_base = bpy.context.active_object
    coin_base.name = "CoinBase"
    bpy.ops.object.shade_smooth()
    
    # 2. Outer Rim Ring (Glow Accent)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.52,
        minor_radius=0.06,
        major_segments=64,
        minor_segments=16,
        location=(0, 0, 0),
        rotation=(math.radians(90), 0, 0)
    )
    rim_ring = bpy.context.active_object
    rim_ring.name = "RimRing"
    bpy.ops.object.shade_smooth()
    
    # 3. Octocat Head (Flattened Oval Sphere)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=32,
        ring_count=24,
        radius=0.72,
        location=(0, 0.12, 0.12),
        rotation=(math.radians(90), 0, 0)
    )
    cat_head = bpy.context.active_object
    cat_head.name = "OctocatHead"
    cat_head.scale = (1.22, 1.0, 0.28)
    bpy.ops.object.shade_smooth()
    
    # 4. Left & Right Cat Ears (Faceted Cones / Prisms)
    bpy.ops.mesh.primitive_cone_add(
        vertices=4,
        radius1=0.28,
        radius2=0.02,
        depth=0.45,
        location=(-0.48, 0.68, 0.12),
        rotation=(0, 0, math.radians(22))
    )
    ear_l = bpy.context.active_object
    ear_l.name = "EarLeft"
    ear_l.scale = (1.0, 0.35, 1.0)
    
    bpy.ops.mesh.primitive_cone_add(
        vertices=4,
        radius1=0.28,
        radius2=0.02,
        depth=0.45,
        location=(0.48, 0.68, 0.12),
        rotation=(0, 0, math.radians(-22))
    )
    ear_r = bpy.context.active_object
    ear_r.name = "EarRight"
    ear_r.scale = (1.0, 0.35, 1.0)
    
    # 5. Octocat Body (Rounded Neck/Torso)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24,
        radius=0.32,
        depth=0.7,
        location=(0, -0.65, 0.12),
        rotation=(math.radians(90), 0, 0)
    )
    cat_body = bpy.context.active_object
    cat_body.name = "OctocatBody"
    cat_body.scale = (1.0, 0.28, 1.0)
    bpy.ops.object.shade_smooth()
    
    # 6. Octocat Tail (Curved Torus Arc)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.42,
        minor_radius=0.09,
        major_segments=32,
        minor_segments=12,
        location=(-0.48, -0.45, 0.12),
        rotation=(math.radians(90), 0, math.radians(-40))
    )
    cat_tail = bpy.context.active_object
    cat_tail.name = "OctocatTail"
    cat_tail.scale = (1.0, 1.0, 0.35)
    bpy.ops.object.shade_smooth()
    
    # Join Octocat silhouette pieces into one relief object
    for obj in [cat_head, ear_l, ear_r, cat_body, cat_tail]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = cat_head
    bpy.ops.object.join()
    octocat_relief = bpy.context.active_object
    octocat_relief.name = "OctocatRelief"
    
    # Materials Setup
    # 1. Dark Obsidian Coin Base
    mat_coin = bpy.data.materials.new(name="CoinBaseMat")
    mat_coin.use_nodes = True
    bsdf_coin = mat_coin.node_tree.nodes.get("Principled BSDF")
    if bsdf_coin:
        if "Base Color" in bsdf_coin.inputs:
            bsdf_coin.inputs["Base Color"].default_value = (0.04, 0.06, 0.1, 1.0)
        if "Metallic" in bsdf_coin.inputs:
            bsdf_coin.inputs["Metallic"].default_value = 0.95
        if "Roughness" in bsdf_coin.inputs:
            bsdf_coin.inputs["Roughness"].default_value = 0.2
    coin_base.data.materials.append(mat_coin)
    
    # 2. Glowing Cyan Rim
    mat_rim = bpy.data.materials.new(name="RimMat")
    mat_rim.use_nodes = True
    bsdf_rim = mat_rim.node_tree.nodes.get("Principled BSDF")
    if bsdf_rim:
        if "Base Color" in bsdf_rim.inputs:
            bsdf_rim.inputs["Base Color"].default_value = (0.1, 0.7, 1.0, 1.0)
        if "Emission Color" in bsdf_rim.inputs:
            bsdf_rim.inputs["Emission Color"].default_value = (0.2, 0.8, 1.0, 1.0)
        elif "Emission" in bsdf_rim.inputs:
            bsdf_rim.inputs["Emission"].default_value = (0.2, 0.8, 1.0, 1.0)
        if "Emission Strength" in bsdf_rim.inputs:
            bsdf_rim.inputs["Emission Strength"].default_value = 3.5
    rim_ring.data.materials.append(mat_rim)
    
    # 3. Pure Luminous White Octocat Silhouette
    mat_cat = bpy.data.materials.new(name="OctocatWhiteMat")
    mat_cat.use_nodes = True
    bsdf_cat = mat_cat.node_tree.nodes.get("Principled BSDF")
    if bsdf_cat:
        if "Base Color" in bsdf_cat.inputs:
            bsdf_cat.inputs["Base Color"].default_value = (0.95, 0.97, 1.0, 1.0)
        if "Metallic" in bsdf_cat.inputs:
            bsdf_cat.inputs["Metallic"].default_value = 0.3
        if "Roughness" in bsdf_cat.inputs:
            bsdf_cat.inputs["Roughness"].default_value = 0.1
        if "Emission Color" in bsdf_cat.inputs:
            bsdf_cat.inputs["Emission Color"].default_value = (0.9, 0.95, 1.0, 1.0)
        elif "Emission" in bsdf_cat.inputs:
            bsdf_cat.inputs["Emission"].default_value = (0.9, 0.95, 1.0, 1.0)
        if "Emission Strength" in bsdf_cat.inputs:
            bsdf_cat.inputs["Emission Strength"].default_value = 1.8
    octocat_relief.data.materials.append(mat_cat)
    
    # Join into single unified logo model
    for obj in [coin_base, rim_ring, octocat_relief]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = coin_base
    bpy.ops.object.join()
    final_logo = bpy.context.active_object
    final_logo.name = "GitHubOctocat3DLogo"
    
    # Export as GLB
    os.makedirs(os.path.dirname(export_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLB',
        export_materials='EXPORT',
        export_apply=True
    )
    print("SUCCESS: Exported 3D GitHub Octocat logo to:", export_path)

if __name__ == "__main__":
    out_path = "/Users/shridhartawate/Documents/Codeisance/frontend/public/models/repoguardian_logo.glb"
    create_octocat_3d_emblem(out_path)
