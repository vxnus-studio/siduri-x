# Modular Design: The "Organ" System

Siduri is not a monolithic application. She is designed as a central "brain" (the orchestrator and memory core) that can be extended with various capabilities, conceptually referred to as **organs**.

## What is an Organ?
An organ is an isolated, plug-and-play module that grants Siduri a specific way to interact with the world. 

Instead of forcing every user to run a heavy, all-in-one system, you can choose exactly which organs Siduri needs for your specific use case.

### Examples of Capabilities
While Siduri's core handles memory and reasoning, organs provide the interfaces:

- **Voice**: Allows Siduri to synthesize speech and talk to you audibly.
- **Vision**: Grants Siduri the ability to see her environment, whether that's a screen capture, an application window, or a camera feed.
- **Platform Integrations**: Allows Siduri to connect to external platforms, read events, and securely interact with audiences.

## Scalable and Lightweight
Because of this modularity, a minimal Siduri instance could be just a private chat interface connected to her memory core. A fully-equipped instance might include voice, vision, and real-time event processing. 

This design ensures she remains lightweight, reliable, and perfectly tailored to what you need her to do.
