import bpy
import os
import math

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Ensure a clean scene collection exists
    if not bpy.data.scenes:
        bpy.data.scenes.new("Scene")

def create_commit_node(export_path):
    reset_scene()
    
    # 1. Central faceted core
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.75, location=(0, 0, 0))
    core = bpy.context.active_object
    core.name = "CommitCore"
    
    # 2. Orbital rings for cyber/git aesthetic
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.15,
        minor_radius=0.06,
        major_segments=24,
        minor_segments=8,
        location=(0, 0, 0),
        rotation=(math.radians(60), math.radians(20), 0)
    )
    ring1 = bpy.context.active_object
    ring1.name = "Ring1"
    
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.3,
        minor_radius=0.04,
        major_segments=24,
        minor_segments=8,
        location=(0, 0, 0),
        rotation=(math.radians(-50), math.radians(65), math.radians(30))
    )
    ring2 = bpy.context.active_object
    ring2.name = "Ring2"
    
    # 3. Branch axle connector
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.18,
        depth=1.8,
        vertices=12,
        location=(0, 0, 0),
        rotation=(0, math.radians(90), 0)
    )
    axle = bpy.context.active_object
    axle.name = "Axle"
    
    # Join objects into one mesh
    for obj in [core, ring1, ring2, axle]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = core
    bpy.ops.object.join()
    node_obj = bpy.context.active_object
    node_obj.name = "GitCommitNode"
    
    # 4. Material with emission
    mat = bpy.data.materials.new(name="CommitNodeMat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = (0.05, 0.5, 0.95, 1.0)
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = 0.85
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = 0.2
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (0.2, 0.8, 1.0, 1.0)
        elif "Emission" in bsdf.inputs:
            bsdf.inputs["Emission"].default_value = (0.2, 0.8, 1.0, 1.0)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = 3.0
            
    node_obj.data.materials.append(mat)
    
    # 5. Export
    os.makedirs(os.path.dirname(export_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLB',
        export_materials='EXPORT',
        export_apply=True
    )
    print("SUCCESS: Exported commit_node.glb to:", export_path)

def create_repoguardian_logo(export_path):
    reset_scene()
    
    # Create Shield Outer Body using a stylized cone/cylinder/cube combination
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=1.2, depth=0.3, location=(0, 0.3, 0))
    top_hex = bpy.context.active_object
    top_hex.name = "ShieldTop"
    top_hex.scale = (1.0, 1.2, 1.0)
    
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=1.2, radius2=0.0, depth=1.6, location=(0, -0.7, 0))
    bottom_cone = bpy.context.active_object
    bottom_cone.name = "ShieldBottom"
    bottom_cone.scale = (1.0, 0.4, 0.3)
    bottom_cone.rotation_euler = (math.radians(180), 0, math.radians(30))
    
    # Central Guardian Core (Gem / Node)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.45, location=(0, 0.1, 0.25))
    core_gem = bpy.context.active_object
    core_gem.name = "GuardianCore"
    core_gem.scale = (1.0, 1.2, 0.7)
    
    # Left & Right Git branch accent bars
    bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=0.9, vertices=8, location=(-0.4, 0.4, 0.2), rotation=(0, 0, math.radians(35)))
    bar_l = bpy.context.active_object
    
    bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=0.9, vertices=8, location=(0.4, 0.4, 0.2), rotation=(0, 0, math.radians(-35)))
    bar_r = bpy.context.active_object

    # Join shield parts
    for obj in [top_hex, bottom_cone, bar_l, bar_r]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = top_hex
    bpy.ops.object.join()
    shield_body = bpy.context.active_object
    shield_body.name = "ShieldFrame"
    
    # Materials
    mat_shield = bpy.data.materials.new(name="ShieldFrameMat")
    mat_shield.use_nodes = True
    bsdf1 = mat_shield.node_tree.nodes.get("Principled BSDF")
    if bsdf1:
        if "Base Color" in bsdf1.inputs:
            bsdf1.inputs["Base Color"].default_value = (0.05, 0.08, 0.14, 1.0)
        if "Metallic" in bsdf1.inputs:
            bsdf1.inputs["Metallic"].default_value = 0.95
        if "Roughness" in bsdf1.inputs:
            bsdf1.inputs["Roughness"].default_value = 0.15
            
    shield_body.data.materials.append(mat_shield)
    
    # Core Gem Material (Glowing Emerald / Cyan)
    mat_core = bpy.data.materials.new(name="GuardianCoreMat")
    mat_core.use_nodes = True
    bsdf2 = mat_core.node_tree.nodes.get("Principled BSDF")
    if bsdf2:
        if "Base Color" in bsdf2.inputs:
            bsdf2.inputs["Base Color"].default_value = (0.0, 0.9, 0.6, 1.0)
        if "Metallic" in bsdf2.inputs:
            bsdf2.inputs["Metallic"].default_value = 0.5
        if "Roughness" in bsdf2.inputs:
            bsdf2.inputs["Roughness"].default_value = 0.1
        if "Emission Color" in bsdf2.inputs:
            bsdf2.inputs["Emission Color"].default_value = (0.0, 1.0, 0.7, 1.0)
        elif "Emission" in bsdf2.inputs:
            bsdf2.inputs["Emission"].default_value = (0.0, 1.0, 0.7, 1.0)
        if "Emission Strength" in bsdf2.inputs:
            bsdf2.inputs["Emission Strength"].default_value = 4.0
            
    core_gem.data.materials.append(mat_core)
    
    # Join everything into final logo
    shield_body.select_set(True)
    core_gem.select_set(True)
    bpy.context.view_layer.objects.active = shield_body
    bpy.ops.object.join()
    final_logo = bpy.context.active_object
    final_logo.name = "RepoGuardianLogo"
    
    # Export
    os.makedirs(os.path.dirname(export_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLB',
        export_materials='EXPORT',
        export_apply=True
    )
    print("SUCCESS: Exported repoguardian_logo.glb to:", export_path)

if __name__ == "__main__":
    node_out = "/Users/shridhartawate/Documents/Codeisance/frontend/public/models/commit_node.glb"
    logo_out = "/Users/shridhartawate/Documents/Codeisance/frontend/public/models/repoguardian_logo.glb"
    
    create_commit_node(node_out)
    create_repoguardian_logo(logo_out)
    print("ALL 3D ASSETS GENERATED SUCCESSFULLY!")
