import pymunk
import pygame

# Game State
objects = {}

def setup(space: pymunk.Space):
    global objects
    objects = {}
    
    # Create the pendulum body
    mass = 1
    length = 100
    # Moment of inertia for a segment hanging from one end
    moment = pymunk.moment_for_segment(mass, (0, 0), (0, length), 5)
    
    body = pymunk.Body(mass, moment)
    body.position = (400, 300)
    body.angle = 3.14 # Start pointing down-ish
    
    # A segment shape
    shape = pymunk.Segment(body, (0, 0), (0, length), 5)
    shape.color = pygame.Color("white")
    shape.elasticity = 0.5
    
    space.add(body, shape)
    
    # Create a pivot joint attached to the static body (the "world")
    # We attach the body's (0,0) point to the world at (400, 300)
    pivot = pymunk.PinJoint(space.static_body, body, (400, 300), (0, 0))
    space.add(pivot)
    
    objects['body'] = body
    objects['length'] = length

def update(dt):
    # Apply a tiny random force or control logic if needed
    # For now, it's a passive pendulum
    pass

def draw(screen: pygame.Surface):
    body = objects.get('body')
    length = objects.get('length')
    
    if body:
        # Calculate end point
        # Body position is the pivot component (0,0) of the segment
        p1 = body.position
        
        # We need to find the other end of the segment. 
        # The segment is defined effectively as a vector of length `length` rotated by `body.angle`
        # Using pymunk's Vec2d for easy rotation
        vec = pymunk.Vec2d(0, length).rotated(body.angle)
        p2 = p1 + vec
        
        # Draw the rod
        pygame.draw.line(screen, (200, 200, 200), p1, p2, 4)
        
        # Draw the pivot
        pygame.draw.circle(screen, (0, 255, 0), (int(p1.x), int(p1.y)), 5)
        
        # Draw the bob
        pygame.draw.circle(screen, (255, 100, 100), (int(p2.x), int(p2.y)), 15)
