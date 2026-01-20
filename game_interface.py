import abc
import pymunk
import pygame

class GameInterface(abc.ABC):
    """
    Abstract base class that all games must implement.
    The Host application uses this interface to interact with loaded games.
    """

    @abc.abstractmethod
    def setup(self, space: pymunk.Space):
        """
        Initialize game objects and physics in the provided Pymunk Space.
        
        Args:
            space: The Pymunk physics space provided by the Host.
        """
        pass

    @abc.abstractmethod
    def update(self, dt: float):
        """
        Update the game state. Called every frame by the Host.
        
        Args:
            dt: Delta time in seconds since the last frame.
        """
        pass

    @abc.abstractmethod
    def draw(self, screen: pygame.Surface):
        """
        Render the game to the screen.
        
        Args:
            screen: The Pygame surface to draw onto.
        """
        pass
