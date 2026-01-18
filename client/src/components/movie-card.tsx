import React from 'react';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Movie } from '@shared/schema';

interface MovieCardProps {
  movie: Movie;
}

export function MovieCard({ movie }: MovieCardProps) {
  return (
    <Link href={`/movie/${movie.id}?source=search`} className="block">
      <Card className="result-card overflow-hidden shadow-md hover:shadow-lg cursor-pointer transition-all hover:-translate-y-1">
        <div className="w-full h-40 bg-gray-200 overflow-hidden">
          {movie.poster_url ? (
            <img
              src={movie.poster_url}
              alt={movie.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://via.placeholder.com/500x300?text=${encodeURIComponent(movie.title)}`;
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <div className="text-center p-4">
                <i className="ri-image-line text-3xl text-gray-400 mb-2"></i>
                <p className="text-sm text-gray-500">No image available</p>
              </div>
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <h4 className="font-semibold text-lg mb-1 line-clamp-1">{movie.title}</h4>
            <span className="bg-primary-light text-primary-dark text-xs px-2 py-1 rounded-full">
              {movie.genre || 'Movie'}
            </span>
          </div>
          <p className="text-gray-500 text-sm mb-2">{movie.release_year}</p>
          <p className="text-sm line-clamp-2">{movie.description || "No description available"}</p>
          <div className="mt-3 flex items-center">
            <span className="flex items-center text-yellow-500 mr-2">
              <i className="ri-star-fill mr-1"></i>
              <span>{movie.rating || 'N/A'}</span>
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
