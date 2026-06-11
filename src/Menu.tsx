import { genres, type Genre } from './genres'

interface MenuProps {
  onSelect: (genre: Genre) => void
}

export default function Menu({ onSelect }: MenuProps) {
  return (
    <div className="menu">
      <p className="menu__prompt">Choose a genre to begin your story</p>
      <div className="menu__grid">
        {genres.map((genre) => (
          <button
            key={genre.id}
            className="genre-circle"
            style={{ '--genre-color': genre.color } as React.CSSProperties}
            onClick={() => onSelect(genre)}
          >
            <span className="genre-circle__emoji" aria-hidden="true">
              {genre.emoji}
            </span>
            <span className="genre-circle__label">{genre.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
