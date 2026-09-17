# Book Helper

A pixel-styled site to help you focus on your reading!

## Description

Book Helper is a site made to help you have a consistent reading schedule. By putting on a timer, you are more likely to push through and read at least a little for the day, growing your mind. 
I personally struggle a lot with reading, so I thought making a site for it would help me and others have a proper reading schedule!

## Features

- Adjustable timer
- Ambient noise
 - Rain
 - White noise
- Leveling up system
- Site theme customization
- Trophies
- Stats

## Technicalities 

This site saves your storage through localStorage, so that you can maintain a streak and maintain your progress as you read. Mask-image was used in order to change the mascot's color with the theme, which was a bit tricky to understand at first. 
The trophy system checks after a session if you have earned an achievement or not, looking at streak length, total hours read, and total sessions completed. The theme system is updated through javascript by changing the value of the color variables when the user changes themes.

## Challenges

It was a struggle to get the modals / window pop ups working how I wanted them to work, since connecting it to a button and making some sort of overlay was difficult to me. I only ever did some sort of window pop-up once, and that took me
a really long time to understand. Eventually, I understood that toggling a class on and off with a click detector is how it could be made.


## Why was this made?

This was made for the Stardance Hack Club program, for the Frictionless mission. 

## AI Usage

I used Claude in order to help me debug minor bugs in my code, as well as figure out how to make the themes and mascot change colors depending on the theme. The white noise was helped by Claude too, since I didn't understand API's all that well.